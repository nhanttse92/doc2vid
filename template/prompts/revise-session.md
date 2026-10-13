The owner sent a follow-up about the finished video "{{title}}":

{{user_message}}

Read `storyboard.json`, the relevant source files and the scene code, and decide whether the request needs a change or just an answer. Keep the document's accuracy: do not invent procedures, numbers or regulations.

If it needs a change, edit `storyboard.json` and the relevant `web/scenes/*.js`, then rebuild with the doc2vid `step` tool:
- If any narration or the scene list changed, run `node tools/validate-storyboard.mjs` until it passes, call `step` with name `narrate`, check that every `ctx.cue` phrase still matches the new narration, then call `step` with name `render` for every scene, because their timing may have moved.
- If only scene code changed, run `node nancheck.mjs <sceneId>` and call `step` with name `render` for each scene you changed.
- Then call `step` with name `assemble`.

Finish with `finish` ok true and a plain reply for the owner: what you changed, or the answer if nothing needed changing. If you could not make the change, call `finish` with ok false and say why.
