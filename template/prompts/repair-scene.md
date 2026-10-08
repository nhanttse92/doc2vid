Repair `web/scenes/{{scene_id}}.js`. The director reported this failure:

{{error}}

Read `AGENT_BRIEF.md`, `STYLE.md`, `KIT.md`, the scene in `storyboard.json`, and `web/timing.js`. Edit only that scene file. Keep every `onscreen_text` item exact and preserve the storyboard visuals. Run `node nancheck.mjs {{scene_id}}`, `node shoot.mjs "scene={{scene_id}}" 0 --sheet`, and `node render.mjs {{scene_id}} --draft` until they succeed. Reply with one plain sentence describing the fix.
