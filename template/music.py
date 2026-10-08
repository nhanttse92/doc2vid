"""Generate the music beds named in storyboard.json with Lyria 3 Pro.

A Lyria track runs about 2:50 and costs $0.08. Each cue gets as many distinct takes (different
seeds, same prompt) as its longest run of consecutive scenes needs, chained with crossfades into
one bed: build/music/<cue>.wav. assemble.py starts the bed afresh at each run of the cue's scenes,
trims it, and ducks it under the voice.

    python3 music.py    # after timing.py (uses scene lengths); cached per take
"""

import json
import math
import subprocess
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


def length(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                 str(path)], capture_output=True, text=True, check=True).stdout)


def main():
    sb = json.loads((HERE / "storyboard.json").read_text())
    timing = json.loads((HERE / "build" / "timing.json").read_text())
    span = {s["id"]: s["duration"] for s in timing["scenes"]}
    order = [s["id"] for s in timing["scenes"]]
    jobs, need = [], {}
    for cue in sb.get("music", []):
        need[cue["id"]] = max(sum(span[s] for s in run) for run in runs(cue["scenes"], order)) + 10
        jobs += [(cue, seed) for seed in range(math.ceil(need[cue["id"]] / TAKE_SECONDS))]

    def take(job):
        cue, seed = job
        out = MUSIC / f"{cue['id']}_take{seed}.wav"
        if not out.exists():
            voice.compose(cue["prompt"], out, seed=100 + seed)
        return cue["id"], out

    with ThreadPoolExecutor(6) as pool:
        made = list(pool.map(take, jobs))
    for cue in sb.get("music", []):
        parts = [p for c, p in made if c == cue["id"]]
        if len(parts) == 1:
            subprocess.run(["cp", parts[0], MUSIC / f"{cue['id']}.wav"], check=True)
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
