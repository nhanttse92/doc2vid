# Storyboard schema

`storyboard.json` is UTF-8 JSON. Run `node tools/validate-storyboard.mjs` after editing it. The existing warehouse fixture uses `narration` for spoken text and cue-level `scenes` lists for music; both forms below are supported.

```json
{
  "meta": {
    "title": "A Clear Walkway",
    "voice": "Charon",
    "persona": "A calm, practical trainer",
    "audience": "new employees",
    "target_seconds": 30,
    "words_per_minute": 163,
    "timing": { "fps": 30, "lead_in": 1.5, "gap": 1, "tail": 2.2 }
  },
  "music": [{ "id": "m01", "prompt": "Quiet instrumental, no vocals", "scenes": ["s01"] }],
  "scenes": [{
    "id": "s01", "title": "Keep the route clear", "mood": "Calm and clear", "music": "m01",
    "beats": [{
      "id": "s01b01",
      "narration": "Look along the route before you move the box. Clear anything that could get in the way, then begin with a steady pace.",
      "delivery": "Measured",
      "visual": "Worker checks the path; a callout appears as the route becomes clear.",
      "onscreen_text": ["Check the route"],
      "hold_seconds": 0
    }]
  }]
}
```

- `meta.title`, `voice`, `persona`, `audience`: required nonempty strings. `voice` is the Gemini TTS voice; there is no implicit default. `persona` describes how the narrator speaks; `audience` guides the audio audit. `target_seconds` is a required positive number. Optional `words_per_minute` guides timing before narration; default is 163. Optional `timing` overrides `fps` (positive integer), `lead_in`, `gap`, and `tail` (nonnegative seconds). Defaults are 30, 1.5, 1, and 2.2.
- `music`: nonempty array of unique cue ids and nonempty instrumental prompts. A cue can list its `scenes`; a scene can name its `music` cue. Each scene must resolve to exactly one cue. If both forms are used, they must agree.
- `scenes`: nonempty array with ids `s01`, `s02`, and so on, unique and in order. Each scene needs a nonempty `title` and `mood`, a music cue reference, and one to twelve beats. `part`, `packet_sections`, `est_seconds`, `words`, and other editorial fields are optional.
- Each beat id starts with its scene id, then `b` and two digits, optionally followed by one lowercase letter, for example `s01b03a`. Ids must be unique. `narration` is nonempty spoken text of at most sixty words, with digits spelled out and no control characters. `visual` is a nonempty instruction. `delivery` is an optional string; omitted means the scene mood and persona apply. `onscreen_text` is a required array of zero to six printable strings, each at most seventy Unicode characters. `hold_seconds` is optional, nonnegative, and adds time after narration and the standard gap.
- The total narration word count must be within thirty-five percent of `target_seconds × 163 / 60 × 0.92`. The validator prints the count, expected count, allowed range and estimated seconds. Spoken facts must be supported by the source document; a visual instruction can illustrate them but cannot add a new procedure.
