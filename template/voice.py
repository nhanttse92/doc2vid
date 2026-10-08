"""Narration voice (Gemini 3.8 Flash TTS), audio 'ear' (Gemini 3.8 Flash) and music (Lyria 3 Pro),
all through OpenRouter. Adapted from ~/Projects/papers-video/rqvae/voice.py.

The API key comes from OPENROUTER_API_KEY, or else from the env file named by
OPENROUTER_ENV_FILE (default: the Lizzy backend's .env). It is never printed or logged.
"""

import base64
import hashlib
import json
import os
import re
import subprocess
import urllib.error
import urllib.request
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUDIO = HERE / "build" / "audio"
API = "https://openrouter.ai/api/v1"
TTS_MODEL = "google/gemini-3.8-flash-tts"
EAR_MODEL = "google/gemini-3.8-flash"
MUSIC_MODEL = "google/lyria-3-pro-preview"
DEFAULT_ENV_FILE = Path.home() / "Projects/lizzy/app/backend/.env"


def _key():
    k = os.environ.get("OPENROUTER_API_KEY")
    if k:
        return k
    path = Path(os.environ.get("OPENROUTER_ENV_FILE", DEFAULT_ENV_FILE))
    for line in path.read_text().splitlines():
        m = re.match(r"\s*(?:export\s+)?OPENROUTER_API_KEY\s*=\s*(.*)", line)
        if m:
            return m.group(1).strip().strip("'\"")
    raise RuntimeError(f"OPENROUTER_API_KEY not set and not found in {path}")


def _open(path, body, timeout):
    req = urllib.request.Request(
        f"{API}/{path}", data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"},
    )
    try:
        return urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read()[:500].decode(errors='replace')}") from None


def _post(path, body, timeout=180):
    with _open(path, body, timeout) as r:
        return r.read()


def wav_duration(path):
    with wave.open(str(path)) as w:
        return w.getnframes() / w.getframerate()


def clip_path(text, style, voice, take=0):
    key = hashlib.sha1(f"{TTS_MODEL}|{voice}|{style}|{text}".encode()).hexdigest()[:16]
    return AUDIO / f"g_{key}_t{take}.wav"


def synth(text, style, voice, take=0):
    """Speak `text` verbatim with delivery `style`; returns a 44.1 kHz mono wav path (cached).

    Every call samples a fresh reading, so a different `take` gives a different delivery.
    Leading/trailing silence is trimmed and loudness normalized so clips sit at one level.
    """
    AUDIO.mkdir(parents=True, exist_ok=True)
    wav = clip_path(text, style, voice, take)
    if wav.exists():
        return wav
    body = {
        # Gemini TTS on OpenRouter only returns raw PCM: 16-bit mono at 24 kHz.
        "model": TTS_MODEL, "input": text, "voice": voice, "response_format": "pcm",
        "provider": {"options": {"google-ai-studio": {"speech_metadata": {"style": style}}}},
    }
    last = None
    for _ in range(3):
        try:
            pcm = _post("audio/speech", body)
            if len(pcm) > 4800:
                break
            last = RuntimeError(f"tiny response ({len(pcm)} bytes): {pcm[:200]!r}")
        except Exception as e:  # transient network/provider errors: retry
            last = e
    else:
        raise RuntimeError(f"TTS failed for {text[:60]!r}: {last}")
    raw = wav.with_suffix(".pcm")
    raw.write_bytes(pcm)
    trim = ("silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,"
            "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse,"
            "loudnorm=I=-16:TP=-1.5:LRA=11")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1",
                    "-i", str(raw), "-af", trim,
                    "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", str(wav)], check=True)
    raw.unlink()
    return wav


def listen(wav, question):
    """Ask Gemini 3.8 Flash about an audio clip (transcription, delivery critique)."""
    data = base64.b64encode(Path(wav).read_bytes()).decode()
    body = {
        "model": EAR_MODEL, "temperature": 0,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": question},
            {"type": "input_audio", "input_audio": {"data": data, "format": "wav"}},
        ]}],
    }
    out = json.loads(_post("chat/completions", body))
    return out["choices"][0]["message"]["content"]


def compose(prompt, out, seed=None):
    """Generate one instrumental track with Lyria 3 Pro; audio output only comes as SSE chunks."""
    body = {"model": MUSIC_MODEL, "messages": [{"role": "user", "content": prompt}],
            "modalities": ["text", "audio"], "audio": {"format": "wav"}, "stream": True}
    if seed is not None:
        body["seed"] = seed
    chunks = []
    with _open("chat/completions", body, timeout=600) as r:
        for line in r:
            line = line.decode().strip()
            if not line.startswith("data: ") or line == "data: [DONE]":
                continue
            event = json.loads(line[6:])
            if "error" in event:
                raise RuntimeError(f"Lyria error: {event['error']}")
            for choice in event.get("choices", []):
                data = (choice.get("delta", {}).get("audio") or {}).get("data")
                if data:
                    chunks.append(base64.b64decode(data))
    if not chunks:
        raise RuntimeError("Lyria returned no audio")
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    # Lyria sends MP3 whatever format is requested; store a 44.1 kHz stereo wav for mixing.
    src = out.with_suffix(".lyria")
    src.write_bytes(b"".join(chunks))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ar", "44100", "-ac", "2",
                    "-c:a", "pcm_s16le", str(out)], check=True)
    src.unlink()
    return out
