You are writing the storyboard for a 20-minute narrated warehouse TRAINING video. The visuals will be 2D motion graphics built in JavaScript (SVG/canvas, no photos, no 3D, no AI video) and rendered frame by frame to a 1080p MP4. Narration will be Gemini 3.8 Flash TTS; background music will be Google Lyria 3 Pro. Several agents will build the scenes in parallel from your storyboard, so it must be precise and self-contained.

## Source
- Project folder: /Users/nhantrinh/Projects/warehouse-training-video
- `source/packet.txt`: `pdftotext -layout` of a 21-page "Warehouse Training Packet" (an OCR of screenshots, so expect OCR errors, e.g. "Part Ill", and some garbled lines such as "Shipments arito us bedone ando end to the are granites received with the").
- `source/page-01.png` … `page-21.png`: 50-dpi page images. For a sharper look at a page, run `pdftoppm -r 110 -f N -l N -png /Users/nhantrinh/Projects/scribd-reader-debug/output/pdf/sample-warehouse-training-packet-ocr.pdf /tmp/...` and view the PNG with the Read tool. Look at the pages: some may contain forms, tables or diagrams worth recreating.
- Table of contents: Part I Purpose (1 Purpose, 2 Common Errors and Preventions); Part II Receiving, Storing, Shipping (3 Receiving of Freight, 4 Packaging of Parts, 5 Storing of Parts, 6 Warehouse Location System, 7 Mezzanine Storage, 8 Packing and Shipping); Part III Ordering, Returns (9 Stock Order Processing, 10 Order Filling, 11 Parts Returns); Part IV Inventory Counts (12); Part V Maintenance (13 Warehouse Housekeeping, 14 Personal Improvement Maintenance — OCR garbled, verify on the page image); Part VI Safety (16 Warehouse Safety, 17 General Safety Practices); Attachments.

## Hard constraints
1. **Accuracy.** Teach only what the packet says. Where OCR is garbled, read the page image; if it is still unreadable, leave that detail out rather than guess. Do not invent numbers, times or rules (the packet's own ones, such as stock orders put away within 24 hours and emergency orders checked in within 2 hours, are fine). General connective framing ("let's look at…") is fine.
2. **Length.** Total 20:00 ± 0:30. Assume narration at about 140 words per minute (measured for this TTS voice with a relaxed persona). Aim for roughly 2,500–2,700 narrated words, plus deliberate non-narrated holds (section title cards, checklist reveals, short pauses). Give every beat an `est_seconds` = words/140×60 + any hold.
3. **Narration lines.** One beat = one TTS clip, at most about 60 words, and each a complete thought. Spell out small numbers in narration ("two hours", "twenty-four hours", "one set") because the TTS misreads bare numerals; digits are fine in on-screen text. No markdown or symbols in narration.
4. **Visuals must be buildable.** Use flat 2D or isometric motion graphics: diagrams, step-by-step sequences, labelled illustrations, do/don't comparisons (red X vs green check), checklists that tick off, icon animations, simple charts and a recurring character (a warehouse associate). Every visual must be composed from a small reusable asset kit that you define. Avoid anything needing realistic people, photos, 3D cameras or lip sync. On-screen text stays short (titles, 3–6 word bullets, labels).
5. **Parallel build.** Group beats into 8–10 scenes of about 1.5–2.5 minutes each, independent of each other, so one agent can build each. Each scene starts and ends on a calm hold suitable for a crossfade. Include an opening (what you'll learn), the parts above in proportion to how much the packet says, a recap or knowledge check near the end, and a closing.

## Write these files (in the project folder)
1. `storyboard.json`:
```
{ "meta": { "title", "target_seconds", "words_per_minute": 140, "total_words", "est_total_seconds",
            "voice": "<one Gemini TTS voice name>", "persona": "<style prompt for the narrator>" },
  "music": [ { "id", "prompt": "<Lyria 3 prompt, instrumental>", "scenes": ["s01", ...] } ],
  "scenes": [ { "id": "s01", "title", "part", "packet_sections": [..], "mood": "<delivery note for this scene>",
                "est_seconds", "beats": [ { "id": "s01b01", "narration", "delivery": "<optional per-line note>",
                "visual": "<precise description of what is on screen and how it animates, in asset-kit terms>",
                "onscreen_text": ["..."], "hold_seconds": 0, "est_seconds" } ] } ] }
```
2. `STYLE.md`: the visual style guide the scene builders share.
   - Canvas 1920×1080 at 30 fps, safe margins and layout grid.
   - Palette (hex) with semantic colours for safety, error, correct and neutral; typography (Google Fonts available offline? assume system fonts or one bundled web font you name).
   - Section title card design, lower-third and caption treatment, checklist design, do/don't comparison design.
   - Motion rules (easing, typical durations, how items enter and exit), transition between beats and between scenes.
   - **The asset kit:** a numbered list of reusable SVG components with names, a one-line description each, and the states or animations each needs. Examples: Worker (poses: stand, walk, kneel, point, thumbs-up, lift with bent knees), BoxTruck, WheelChock, DockDoor, Pallet, Carton, PalletRack with bins, LocationLabel, Mezzanine with stairs, Forklift, Clipboard/Manifest, PackingSlip, Computer terminal, ScanGun, Camera icon, Kit/Set/Multipack diagrams, Broom/Housekeeping, PPE items, Hazard sign, Checklist, Callout, ProgressTimeline. Keep it to what the storyboard actually uses.
3. `STORYBOARD.md`: a readable version for the user: scene list with durations, then each beat's narration and visual.

Before finishing, validate `storyboard.json` with `python3 -c "import json;json.load(open('storyboard.json'))"`. Recompute total words and estimated seconds with a small script and adjust until the estimate is within 19:30–20:30.

## Reply with
Under 300 words: total words, estimated duration, the scene list (id, title, est. duration), the chosen voice and persona, the music cues, and anything in the packet you had to leave out because it was unreadable.
