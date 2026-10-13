"""Checks music.py's retry, reuse and clean-failure behaviour without calling Lyria.

Run from a job directory copy: python3 tests/music_retry_check.py <job_dir>
"""
import json
import subprocess
import sys
import types
from pathlib import Path

job = Path(sys.argv[1])
sys.path.insert(0, str(job))
calls = []


def fake_compose(prompt, out, seed=None):
    calls.append(seed)
    raise RuntimeError("Lyria returned no audio")


sys.modules["voice"] = types.SimpleNamespace(compose=fake_compose, _key=lambda: "test-key")
import music  # noqa: E402

music.time.sleep = lambda seconds: None
music.MUSIC.mkdir(parents=True, exist_ok=True)
sb = json.loads((job / "storyboard.json").read_text())
cue = sb["music"][0]
stale = music.MUSIC / f"{cue['id']}.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "1",
                str(stale)], check=True)
music.bed_meta(cue).write_text(json.dumps({"prompt": "an older prompt", "offline": False, "seconds": 1}))
try:
    music.main()
except SystemExit as exit_:
    message = str(exit_.code)
else:
    raise AssertionError("music.main() should exit when every take fails")
assert message.startswith("Music failed for ") and "Lyria returned no audio" in message and "\n" not in message, message
assert len(calls) >= music.ATTEMPTS and len(calls) % music.ATTEMPTS == 0, calls  # every take tried ATTEMPTS times
assert not stale.exists(), "a bed that could not be replaced must be removed"
print("ok:", message, "| attempts:", len(calls))
