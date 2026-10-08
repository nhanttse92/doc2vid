"""Assemble the final film: scene videos + narration placed on the timeline + ducked music + subtitles.

    python3 assemble.py            # needs build/video/<scene>.mp4 for every scene, build/narration.json
    python3 assemble.py --no-music

Writes out/warehouse_training.mp4 (soft subtitles included) and out/warehouse_training.srt.
"""

import argparse
import array
import json
import subprocess
import textwrap
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
BUILD, OUT = HERE / "build", HERE / "out"
RATE = 44100
NAME = "warehouse_training"


def ff(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *map(str, args)], check=True)


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out)


def concat_video(timing):
    listing = BUILD / "concat.txt"
    listing.write_text("".join(f"file '{BUILD / 'video' / (s['id'] + '.mp4')}'\n" for s in timing["scenes"]))
    out = BUILD / "film_video.mp4"
    ff("-f", "concat", "-safe", 0, "-i", listing, "-c", "copy", out)
    got = duration(out)
    if abs(got - timing["total"]) > 0.1:
        raise SystemExit(f"video is {got:.2f}s but the timeline is {timing['total']:.2f}s; re-render the stale scenes")
    return out


def narration_track(timing):
    """Place every chosen take at its absolute time on one mono track (exact sample offsets)."""
    total = array.array("h", bytes(2 * int(timing["total"] * RATE + RATE)))
    for scene in timing["scenes"]:
        for beat in scene["beats"]:
            if not beat["wav"]:
                if beat["text"]:
                    raise SystemExit(f"{beat['id']} has narration text but no audio; run narrate.py then timing.py")
                continue
            with wave.open(str(HERE / beat["wav"])) as w:
                assert w.getframerate() == RATE and w.getnchannels() == 1 and w.getsampwidth() == 2
                samples = array.array("h", w.readframes(w.getnframes()))
            at = int(round((scene["start"] + beat["start"]) * RATE))
            total[at:at + len(samples)] = samples
    out = BUILD / "narration_track.wav"
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(RATE)
        w.writeframes(total[: int(timing["total"] * RATE)].tobytes())
    return out


def music_track(timing, cues):
    """Each run of consecutive scenes sharing a cue gets that cue's bed from its start; runs
    overlap by FADE seconds at their boundaries and crossfade."""
    from music import runs
    FADE = 3.0
    order = [s["id"] for s in timing["scenes"]]
    starts = {s["id"]: s["start"] for s in timing["scenes"]}
    ends = {s["id"]: s["start"] + s["duration"] for s in timing["scenes"]}
    segments = sorted((starts[run[0]], ends[run[-1]], cue["id"]) for cue in cues for run in runs(cue["scenes"], order))
    inputs, chains = [], []
    for i, (a, b, cue_id) in enumerate(segments):
        first, last = i == 0, i == len(segments) - 1
        a, b = max(0.0, a - (0 if first else FADE / 2)), min(timing["total"], b + (0 if last else FADE / 2))
        inputs += ["-i", BUILD / "music" / f"{cue_id}.wav"]
        chains.append(f"[{i}:a]aformat=sample_rates={RATE}:channel_layouts=stereo,atrim=0:{b - a:.3f},asetpts=PTS-STARTPTS,"
                      f"afade=t=in:d={1.5 if first else FADE},afade=t=out:st={b - a - FADE:.3f}:d={FADE},"
                      f"adelay={int(a * 1000)}|{int(a * 1000)}[m{i}]")
    mix = "".join(f"[m{i}]" for i in range(len(segments))) + f"amix=inputs={len(segments)}:normalize=0:duration=longest[out]"
    out = BUILD / "music_track.wav"
    ff(*inputs, "-filter_complex", ";".join(chains + [mix]), "-map", "[out]", "-t", f"{timing['total']:.3f}", out)
    return out


def srt(timing):
    def stamp(t):
        ms = int(round(t * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    rows, n = [], 0
    for scene in timing["scenes"]:
        for beat in scene["beats"]:
            if not beat["text"] or not beat["dur"]:
                continue
            chunks = textwrap.wrap(beat["text"], 84)  # two subtitle lines of about 42 characters
            total_chars = sum(len(c) for c in chunks)
            t = scene["start"] + beat["start"]
            for chunk in chunks:
                d = beat["dur"] * len(chunk) / total_chars
                n += 1
                rows.append(f"{n}\n{stamp(t)} --> {stamp(t + d)}\n" + "\n".join(textwrap.wrap(chunk, 44)) + "\n")
                t += d
    out = OUT / f"{NAME}.srt"
    out.write_text("\n".join(rows))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-music", action="store_true")
    args = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    timing = json.loads((BUILD / "timing.json").read_text())
    cues = json.loads((HERE / "storyboard.json").read_text()).get("music", [])
    video = concat_video(timing)
    voice = narration_track(timing)
    subs = srt(timing)
    final = OUT / f"{NAME}.mp4"
    if args.no_music or not cues:
        mix = f"[1:a]aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11[a]"
        inputs = ["-i", video, "-i", voice]
    else:
        music = music_track(timing, cues)
        # Music sits well under the voice and ducks further whenever the narrator speaks.
        mix = ("[1:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit=2[v][key];"
               "[2:a]volume=-17dB[bed];"
               "[bed][key]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=600[duck];"
               "[v][duck]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[a]")
        inputs = ["-i", video, "-i", voice, "-i", music]
    ff(*inputs, "-i", subs, "-filter_complex", mix, "-map", "0:v", "-map", "[a]", "-map", f"{len(inputs) // 2}:s",
       "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", RATE, "-c:s", "mov_text",
       "-metadata:s:s:0", "language=eng", "-movflags", "+faststart", final)
    print(f"{final.relative_to(HERE)}  {duration(final) / 60:.2f} min; subtitles {subs.relative_to(HERE)}")


if __name__ == "__main__":
    main()
