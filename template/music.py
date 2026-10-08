"""Generate the music beds named in storyboard.json with Lyria 3 Pro.

A Lyria track runs about 2:50 and costs $0.08. Each cue gets as many distinct takes (different
seeds, same prompt) as its longest run of consecutive scenes needs, chained with crossfades into
one bed: build/music/<cue>.wav. assemble.py starts the bed afresh at each run of the cue's scenes,
trims it, and ducks it under the voice.

    python3 music.py    # after timing.py (uses scene lengths); cached per take
"""

import json
import hashlib
import math
import os
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import voice

HERE = Path(__file__).resolve().parent
MUSIC = HERE / "build" / "music"
XFADE = 4.0
TAKE_SECONDS = 165  # usable length of one Lyria take after crossfading


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
    jobs, need = [], {}
    for cue in sb.get("music", []):
        cue_runs = runs(cue_scenes(cue, sb), order)
        if not cue_runs:
            continue
        need[cue["id"]] = max(sum(span[s] for s in run) for run in cue_runs) + 10
        jobs += [(cue, seed) for seed in range(math.ceil(need[cue["id"]] / TAKE_SECONDS))]

    def take(job):
        cue, seed = job
        out = take_path(cue["prompt"], TAKE_SECONDS, 100 + seed, offline)
        if not out.exists():
            if offline:
                silence(out, TAKE_SECONDS + XFADE)
            else:
                voice.compose(cue["prompt"], out, seed=100 + seed)
        return cue["id"], out

    with ThreadPoolExecutor(6) as pool:
        made = list(pool.map(take, jobs))
    for cue in sb.get("music", []):
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
        print(f"{cue['id']}: {len(parts)} takes -> {length(bed):.0f}s bed for runs of up to {need[cue['id']]:.0f}s")


if __name__ == "__main__":
    main()
