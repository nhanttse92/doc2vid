"""Generate the music beds named in storyboard.json with Lyria 3 Pro.

A Lyria track runs about 2:50 and costs $0.08. Each cue gets as many distinct takes (different
seeds, same prompt) as its longest run of consecutive scenes needs, chained with crossfades into
one bed: build/music/<cue>.wav. assemble.py starts the bed afresh at each run of the cue's scenes,
trims it, and ducks it under the voice.

    python3 music.py    # after timing.py (uses scene lengths); cached per take and per bed

A bed is reused while its prompt is unchanged and it is still long enough, so a revision that
only shifts timing makes no new Lyria calls. Lyria sometimes returns an empty stream, so each take
is retried a few times before the cue is given up.
"""

import json
import hashlib
import math
import os
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import voice

HERE = Path(__file__).resolve().parent
MUSIC = HERE / "build" / "music"
XFADE = 4.0
TAKE_SECONDS = 165  # usable length of one Lyria take after crossfading
ATTEMPTS = 3


def runs(cue_scenes, order):
    """Group a cue's scenes into runs of consecutive scenes, in film order."""
    out = []
    for sid in [s for s in order if s in cue_scenes]:
        if out and order.index(sid) == order.index(out[-1][-1]) + 1:
            out[-1].append(sid)
        else:
            out.append([sid])
    return out


def cue_scenes(cue, storyboard):
    return cue.get("scenes") or [s["id"] for s in storyboard["scenes"] if s.get("music") == cue["id"]]


def take_path(prompt, seconds, seed, offline):
    key = hashlib.sha256(json.dumps([prompt, seconds, seed], ensure_ascii=False).encode()).hexdigest()[:20]
    return MUSIC / f"take_{key}{'_offline' if offline else ''}.wav"


def silence(path, seconds):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
                    "anullsrc=r=44100:cl=stereo", "-t", str(seconds), "-c:a", "pcm_s16le", str(path)], check=True)


def compose(cue_id, prompt, out, seed):
    """One Lyria take, retried on transient failures (empty stream, network, server errors)."""
    for attempt in range(1, ATTEMPTS + 1):
        try:
            return voice.compose(prompt, out, seed=seed)
        except (RuntimeError, OSError) as exc:
            # Missing key, bad request or no credit will not fix itself on a retry.
            if any(code in str(exc) for code in ("HTTP 400", "HTTP 401", "HTTP 402", "HTTP 403", "OPENROUTER_API_KEY")) or attempt == ATTEMPTS:
                raise RuntimeError(f"{cue_id}: {exc}") from None
            print(f"{cue_id}: {exc}; retrying ({attempt + 1}/{ATTEMPTS})", flush=True)
            time.sleep(5 * attempt)


def bed_meta(cue):
    return MUSIC / f"{cue['id']}.json"


def reusable(cue, need, offline):
    """True when the cue's existing bed was made from the same prompt and is long enough."""
    bed, meta = MUSIC / f"{cue['id']}.wav", bed_meta(cue)
    if not bed.exists() or not meta.exists():
        return False
    try:
        saved = json.loads(meta.read_text())
    except ValueError:
        return False
    return saved.get("prompt") == cue["prompt"] and saved.get("offline") == offline and saved.get("seconds", 0) >= need


def length(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                 str(path)], capture_output=True, text=True, check=True).stdout)


def main():
    sb = json.loads((HERE / "storyboard.json").read_text())
    timing = json.loads((HERE / "build" / "timing.json").read_text())
    span = {s["id"]: s["duration"] for s in timing["scenes"]}
    order = [s["id"] for s in timing["scenes"]]
    MUSIC.mkdir(parents=True, exist_ok=True)
    offline = os.environ.get("DOC2VID_OFFLINE") == "1"
    if not offline and sb.get("music"):
        try:
            voice._key()
        except RuntimeError as exc:
            sys.exit(str(exc))
    jobs, need, reused = [], {}, set()
    for cue in sb.get("music", []):
        cue_runs = runs(cue_scenes(cue, sb), order)
        if not cue_runs:
            continue
        need[cue["id"]] = max(sum(span[s] for s in run) for run in cue_runs) + 10
        if reusable(cue, need[cue["id"]], offline):
            reused.add(cue["id"])
            print(f"{cue['id']}: reusing the existing bed (needs {need[cue['id']]:.0f}s)")
            continue
        jobs += [(cue, seed) for seed in range(math.ceil(need[cue["id"]] / TAKE_SECONDS))]

    def take(job):
        cue, seed = job
        out = take_path(cue["prompt"], TAKE_SECONDS, 100 + seed, offline)
        if not out.exists():
            if offline:
                silence(out, TAKE_SECONDS + XFADE)
            else:
                compose(cue["id"], cue["prompt"], out, 100 + seed)
        return cue["id"], out

    made, failed = [], {}
    with ThreadPoolExecutor(6) as pool:
        futures = [(job[0]["id"], pool.submit(take, job)) for job in jobs]
        for cue_id, future in futures:
            try:
                made.append(future.result())
            except Exception as exc:
                failed.setdefault(cue_id, str(exc))
    for cue in sb.get("music", []):
        if cue["id"] in failed:
            # A stale bed would stop partway through the longer scenes, so drop it: assemble.py then
            # leaves this cue's scenes without music instead.
            (MUSIC / f"{cue['id']}.wav").unlink(missing_ok=True)
            bed_meta(cue).unlink(missing_ok=True)
            continue
        if cue["id"] in reused:
            continue
        parts = [p for c, p in made if c == cue["id"]]
        if not parts:
            continue
        if len(parts) == 1:
            shutil.copyfile(parts[0], MUSIC / f"{cue['id']}.wav")
        else:
            inputs = [a for p in parts for a in ("-i", str(p))]
            chain, last = [], "[0:a]"
            for i in range(1, len(parts)):
                label = f"[x{i}]"
                chain.append(f"{last}[{i}:a]acrossfade=d={XFADE}:c1=tri:c2=tri{label}")
                last = label
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(chain),
                            "-map", last, "-c:a", "pcm_s16le", str(MUSIC / f"{cue['id']}.wav")], check=True)
        bed = MUSIC / f"{cue['id']}.wav"
        bed_meta(cue).write_text(json.dumps({"prompt": cue["prompt"], "offline": offline, "seconds": round(length(bed), 2)}))
        print(f"{cue['id']}: {len(parts)} takes -> {length(bed):.0f}s bed for runs of up to {need[cue['id']]:.0f}s")
    if failed:
        # One readable line for the job page instead of a thread-pool traceback.
        sys.exit(f"Music failed for {', '.join(sorted(failed))}: {'; '.join(failed[c].split(': ', 1)[-1] for c in sorted(failed))}")


if __name__ == "__main__":
    main()
