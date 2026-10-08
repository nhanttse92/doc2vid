The owner sent a follow-up about the finished video:

{{user_message}}

Read `job.json`, `storyboard.json`, and the relevant source files and scene code. Decide whether the request needs a file change or just an answer. Preserve document accuracy: do not invent procedures, numbers or regulations. You may edit `storyboard.json` and relevant `web/scenes/*.js` only. If you edit the storyboard, run `node tools/validate-storyboard.mjs` until it passes. If you edit a scene, run `node nancheck.mjs <sceneId>` and `node render.mjs <sceneId> --draft` for every scene touched. If narration text changes, check every `ctx.cue` phrase in that scene still matches or adjust the scene code. The director will rerun the pipeline after you finish, so do not run `narrate.py`, `music.py`, `assemble.py`, or full renders.

Reply to the owner in plain sentences saying what you changed, or answer the question if no file needed changing.
