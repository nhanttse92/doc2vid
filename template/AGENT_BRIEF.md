# Agent brief: animating the warehouse training video

Project: `/Users/nhantrinh/Projects/warehouse-training-video`. It is a 20-minute narrated training video, made entirely as 2D SVG motion graphics in JavaScript. Headless Chromium renders it frame by frame to 1920×1080 at 30 fps. The narration (Gemini TTS) and music (Lyria) are generated separately and laid under the video by `assemble.py`. You only make pictures move.

Read first: `STYLE.md` (the visual rules, which are binding) and `STORYBOARD.md` / `storyboard.json` (what each beat shows).

## How it fits together

- `web/index.html` loads, in order:
  1. `timing.js` (generated)
  2. `engine.js`
  3. `kit/base.js`
  4. `kit/characters.js`, `kit/ui.js`, `kit/objects.js`, `kit/docs.js`
  5. then the requested scene, `web/scenes/<id>.js`.
- **Determinism is the one hard rule.** A scene builds its SVG nodes once in `build(ctx)`. Then `render(t, ctx, state)` sets every attribute from the scene-local time `t` (in seconds) alone. The renderer may call `render` with any `t`, in any order, and must always get the same frame for the same `t`. That means:
  - no `Math.random()` (use a seeded hash of an index), no `Date`, no `requestAnimationFrame`, no CSS animations or transitions, no SMIL;
  - no state that accumulates between `render` calls.
- **Engine (`web/engine.js`):**
  - `Engine.el(tag, attrs, parent)`: create a node.
  - `Engine.set(node, attrs)`: idempotent; skips unchanged values. `text:` sets textContent.
  - `Engine.place(node, {x, y, s, r, o})`: translate, scale, rotate, opacity.
  - `Engine.prog(t, t0, dur, easeFn)`: progress 0→1. `Engine.win(t, a, b, fade)`: visibility window.
  - `Engine.keys(t, [[t0, v0], [t1, v1], ...], easeFn)`: keyframes. `Engine.clamp`, `Engine.lerp`, `Engine.ease.*`.
  - `Engine.scene(id, { build(ctx), render(t, ctx, state) })` registers a scene.
- **`ctx`:**
  - `ctx.root`: your scene's `<g>`.
  - `ctx.duration`: the scene length in seconds.
  - `ctx.beats`: the scene's beats in order.
  - `ctx.beat(id)` returns `{start, dur, slot, end, text, onscreen_text}`. `start` is when the beat's narration starts (scene-local). `dur` is the narration length. `slot` is the beat's full length (narration + 1.0 s gap + hold). `end = start + slot`.
  - `ctx.cue(id, 'phrase', nth=0)` is the approximate moment that phrase is spoken in the beat, estimated from its character position. `ctx.cue(id, 0.5)` is halfway through the narration.
  - **Never hard-code seconds from `est_seconds`.** Timing is regenerated from the real narration while you work, so beats will stretch or shrink. Derive every time from `ctx.beat`/`ctx.cue`, with small fixed offsets such as `+0.4`.
  - Each scene has 1.5 s before its first beat and 2.2 s after its last. The player fades the scene in from and out to `bg-dark` over 0.5 s at each end. You don't draw that fade, but keep the first and last 15 frames calm.
- **Kit base (`web/kit/base.js`):**
  - `Kit.C`: the palette from STYLE.md, e.g. `Kit.C.ink`, `Kit.C.accent`, `Kit.C.shirt.driver`.
  - `Kit.ease.enter|exit|pop|linear`: the STYLE.md curves.
  - `Kit.presence(t, tIn, tOut)` returns `{o, dy}` for the standard enter (fade + 24 px rise) and exit (fade + 16 px).
  - `Kit.text(parent, str, {x, y, size, weight, fill, anchor, spacing, upper})`: text in Inter.
  - `Kit.measure(str, size, weight)`: text width in pixels.
  - `Kit.shadow(parent, width, {x, y})`, `Kit.group(parent)`, `Kit.show(node, bool)`.

## Kit component contract (for kit builders; scene builders rely on it)

- Each component is a factory on `window.Kit`: `const thing = Kit.Name(parent, options)`. It returns an object with:
  - `thing.g`: its root `<g>`;
  - `thing.update(params)`: sets the component's whole visual state from `params`, idempotent and cheap. Call it every frame from `render`.
  - Put time-based detail in `params` (e.g. `{pose: 'walk', t}` for a walk cycle or idle breathing) so the component stays a pure function of what it is given.
- **Origins:**
  - Grounded objects (Worker, Pallet, Rack, Truck, Forklift, Cart): bottom-centre on the floor line.
  - Cards, documents and UI panels: top-left unless documented otherwise.
  - Icons: centre.
  - Default sizes follow STYLE.md §6. The caller scales with `Engine.place`.
- Create every node in the factory. In `update`, only toggle `display` (via `Kit.show`) and set attributes. Never create or remove nodes per frame. No SVG filters (blur and drop shadows are slow and inconsistent). Flat fills and 2.5 px `ink` outlines, per STYLE.md.
- Start every factory with a comment giving its options, its `update` params (with allowed values) and its origin. The scene builders read these headers.

## Ownership (parallel agents: touch only your files)

| Agent | Writes | Never edits |
|---|---|---|
| kit:<name> | `web/kit/<name>.js`, `web/kit/<name>.gallery.js` | anything else |
| scene:<id> | `web/scenes/<id>.js` | engine, player, kit files, `timing.js`, `storyboard.json`, `STYLE.md`, other scenes |

- If a kit component is missing a pose or has a bug, work around it inside your scene file. You can wrap it or draw a scene-local helper. Report it in your result.
- Scene-specific assets that STYLE.md lists but the shared kit doesn't provide (used by only one scene) are drawn in your scene file, to the STYLE.md spec.

## Checking your work (do this; nobody else will look before the final cut)

- `node shoot.mjs "scene=s03" s03b01,s03b02,s03b03 --sheet` writes 960×540 stills (beat ids mean 60 % through that beat's slot; plain numbers are seconds) and a contact sheet in `build/shots/`. Look at the images with the Read tool, then fix and re-shoot. It also prints page errors.
- `node shoot.mjs "kit=characters" 0,1,2,3 --sheet` does the same for a kit gallery page, `web/kit/characters.gallery.js`. A gallery registers `Engine.scene('gallery', { duration, build, render })`.
- `node render.mjs --draft s03` renders a 960×540, 15 fps draft to `build/draft/s03.mp4`. To check motion, extract frames, e.g. `ffmpeg -ss 12 -i build/draft/s03.mp4 -frames:v 6 -vf fps=4,tile=3x2 build/shots/s03-motion.png`.
- `node render.mjs s03` does the full 1080p render to `build/video/s03.mp4`. It must finish without errors before you report done. It takes about 1–2 minutes; other agents render at the same time, so it may be slower.
- Before handing in, check against STYLE.md §7:
  - text at least 22 px and inside the safe area (80 px margins);
  - no overlaps you didn't intend; red never the only signal;
  - every on-screen text item from the storyboard present and spelled exactly;
  - nothing frozen for more than about 4 s (add idle life).
