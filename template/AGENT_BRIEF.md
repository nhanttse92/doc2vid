# Agent brief: animating a training video scene

This directory is one independent video job. Its visuals are deterministic two-dimensional SVG scenes, rendered frame by frame in Chromium at 1920×1080. Read `STYLE.md`, `KIT.md`, and the assigned scene in `storyboard.json`. The generated `web/timing.js` is the source of actual audio timing.

## How the player works

`web/index.html` loads timing, engine, all kit files, then `web/scenes/<id>.js` from `?scene=<id>`. Register `Engine.scene(id, {build(ctx), render(t, ctx, state)})`. Build all nodes once in `build`. `render` must set the whole state as a pure function of scene-local time `t`; the renderer may visit frames in any order. Do not use `Math.random`, `Date`, `requestAnimationFrame`, CSS animation or transitions, SMIL, or accumulating state.

`Engine.el(tag, attrs, parent)` creates SVG nodes. `Engine.set(node, attrs)` updates attributes; `text` sets textContent. `Engine.place(node, {x,y,s,r,o})` positions a group. `Engine.prog`, `Engine.win`, `Engine.keys`, `Engine.clamp`, `Engine.lerp`, and `Engine.ease` provide time functions. Use `Kit.C`, `Kit.ease`, `Kit.presence`, and component factories described in `KIT.md`.

`ctx.root` is the scene group; `ctx.duration` is its length. `ctx.beats` is the ordered timing list. `ctx.beat(id)` returns `{start,dur,slot,end,text,onscreen_text}`. `ctx.cue(id, 'exact phrase', nth=0)` estimates the time a phrase is spoken; `ctx.cue(id, 0.5)` means halfway through the narration. A phrase that is absent throws. Derive every important time from these values. Do not copy `est_seconds` into animation code because narration can change.

Each factory returns `{g, update(params)}` and creates its nodes up front. Update its state every frame, passing `t` when it has idle motion. Grounded objects sit bottom-centre on the floor line, cards and panels usually start at top-left, and icons are usually centred; see `KIT.md` for exceptions. Use `Engine.place` on `g` to position and scale it. You may draw small scene-local helpers that the kit does not provide.

## Scene quality

Follow all rules in `STYLE.md`. Keep text at least 22 px within 80 px safe margins. Include every `onscreen_text` item exactly as written, with wrapping if needed. Show the beat's requested visual, give long holds subtle idle life, keep the first and last fifteen frames calm, and avoid unintended overlaps. Red must never be the only signal for an error.

Check stills with `node shoot.mjs "scene=s01" s01b01,s01b02 --sheet`, changing ids for your scene. Inspect the images and fix visual problems. Finish with `node nancheck.mjs s01` and `node render.mjs s01 --draft`. Your assigned output is only `web/scenes/<id>.js`; the director handles narration, music, full renders and assembly.
