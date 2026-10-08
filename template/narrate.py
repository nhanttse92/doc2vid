"""Narrate every storyboard beat: MAX_TAKES readings each, audited by ear, best take recorded.

Gemini 3.8 Flash listens to each take, checks the words match exactly and rates how natural
it sounds; verdicts are cached beside the clips. The chosen take per beat goes to
build/narration.json, which timing.py turns into the beat timeline the scenes animate to.

    python3 narrate.py            # synthesize + audit all beats (cached; safe to re-run)
    python3 narrate.py s03 s04    # only these scenes
    python3 narrate.py --report   # summary of the current choices, no API calls
"""

import argparse
import json
import os
import re
import sys
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import voice

HERE = Path(__file__).resolve().parent
OUT = HERE / "build" / "narration.json"
MAX_TAKES = 3
CHECK = (
    'You are checking narration audio for a workplace training video. Expected text: "{text}". '
    "Reply as JSON only, no markdown: "
    '{{"matches": true/false (ignore number formatting such as 24 vs twenty-four), '
    '"differences": [words missing, added, or changed], '
    '"clarity": 1-10 (easy to follow for {audience}), '
    '"naturalness": 1-10 (10 = indistinguishable from a real person talking, 1 = robotic text-to-speech), '
    '"issues": "artifacts, mispronunciations, odd pauses, rushed or sing-song delivery, or an empty string"}}'
)


def storyboard():
    return json.loads((HERE / "storyboard.json").read_text())


def beats(sb, only=()):
    persona = sb["meta"]["persona"]
    for scene in sb["scenes"]:
        if only and scene["id"] not in only:
            continue
        for beat in scene["beats"]:
            if beat.get("narration", "").strip():
                style = " ".join(filter(None, [persona, scene.get("mood"), beat.get("delivery")]))
                yield scene["id"], beat["id"], " ".join(beat["narration"].split()), style


def audited(wav, text, audience):
    path = wav.with_suffix(".json")
    if path.exists():
        return json.loads(path.read_text())
    raw = voice.listen(wav, CHECK.format(text=text, audience=audience))
    try:
        v = json.loads(re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.M))
    except json.JSONDecodeError:
        v = {"matches": None, "raw": raw[:300]}
    v["duration"] = voice.wav_duration(wav)
    path.write_text(json.dumps(v))
    return v


def rank(v):
    return (v.get("matches") is True, (v.get("naturalness") or 0) + (v.get("clarity") or 0))


def take(job):
    (scene, beat, text, style), n, speaker, audience = job
    wav = voice.synth(text, style, speaker, take=n)
    return beat, n, wav, audited(wav, text, audience)


def offline_take(item, speaker):
    scene, beat, text, style = item
    cached = voice.clip_path(text, style, speaker)
    wav = cached.with_name(f"{cached.stem}_offline.wav")
    wav.parent.mkdir(parents=True, exist_ok=True)
    seconds = len(text.split()) / 163 * 60 + 0.3
    frames = round(seconds * 44100)
    if not wav.exists() or abs(voice.wav_duration(wav) - seconds) > 1 / 44100:
        with wave.open(str(wav), "wb") as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(44100)
            out.writeframes(bytes(frames * 2))
    return beat, {"scene": scene, "text": text, "take": 0,
                  "wav": str(wav.relative_to(HERE)), "duration": frames / 44100,
                  "matches": True, "clarity": 0, "naturalness": 0}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true")
    ap.add_argument("scenes", nargs="*")
    args = ap.parse_args()
    sb = storyboard()
    speaker = sb["meta"]["voice"]
    items = list(beats(sb, set(args.scenes)))
    chosen = json.loads(OUT.read_text()) if OUT.exists() else {}
    current = {beat["id"] for scene in sb["scenes"] for beat in scene["beats"]}
    chosen = {key: value for key, value in chosen.items() if key in current}

    if not args.report:
        if os.environ.get("DOC2VID_OFFLINE") == "1":
            for item in items:
                beat, entry = offline_take(item, speaker)
                chosen[beat] = entry
        else:
            try:
                voice._key()  # fail before starting any concurrent synthesis
            except RuntimeError as exc:
                sys.exit(str(exc))
            jobs = [(item, n, speaker, sb["meta"].get("audience", "a new employee"))
                    for item in items for n in range(MAX_TAKES)]
            with ThreadPoolExecutor(10) as pool:
                results = list(pool.map(take, jobs))
            by_beat = {}
            for beat, n, wav, v in results:
                by_beat.setdefault(beat, []).append((rank(v), -n, n, wav, v))
            for scene, beat, text, _ in items:
                _, _, n, wav, v = max(by_beat[beat])
                chosen[beat] = {"scene": scene, "text": text, "take": n,
                                "wav": str(wav.relative_to(HERE)), **v}
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(chosen, indent=1))

    rows = [chosen[b] for _, b, _, _ in items if b in chosen]
    if not rows:
        sys.exit("no narration yet")
    mean = lambda k: sum(r.get(k) or 0 for r in rows) / len(rows)
    bad = [r for r in rows if r.get("matches") is not True]
    print(f"{len(rows)} beats, {sum(r['duration'] for r in rows) / 60:.1f} min of narration, "
          f"{sum(r['take'] > 0 for r in rows)} use a later take, {len(bad)} mismatched; "
          f"mean clarity {mean('clarity'):.1f}, naturalness {mean('naturalness'):.1f}")
    for r in bad:
        print("MISMATCH", r["scene"], r["text"][:70], r.get("differences") or r.get("raw"))
    for r in rows:
        if r.get("issues"):
            print("issue:", r["scene"], r["text"][:50], "->", r["issues"])


if __name__ == "__main__":
    main()
