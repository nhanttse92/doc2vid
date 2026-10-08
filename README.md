# doc2vid

Turns an uploaded training document (.pdf, .doc, .docx) into a narrated, animated training video.
A Node service on the Mac mini runs the pipeline and Claude Code sessions; the page lives at
albinilabs.com/doc2vid (Cloudflare Worker in the albini-lab repo) and reaches the Mac mini through a
Cloudflare Tunnel.

- `template/` is the video library from `warehouse-training-video` (JavaScript/SVG kit, engine,
  renderer, narration, music and assembly scripts). Each job runs in its own copy of it.
- `server/` is the job service.
- `deploy/` holds the launchd and install scripts for the Mac mini.
- `examples/warehouse/` is the original 20-minute film's storyboard and scenes, kept as fixtures.
- `reference/` holds the prompts the original storyboard and scene agents were given.

## Template

Copy `template/` once per job and symlink its `node_modules` into the copy. Add `job.json`,
`source/text.txt` (plus the original upload and optional page images), then have the storyboard
agent write `storyboard.json` using `template/prompts/storyboard.md`. Validate it with
`node tools/validate-storyboard.mjs`. The director runs `python3 narrate.py`, `python3 timing.py`,
`python3 music.py`, scene agents or `node tools/fallback-scene.mjs <id>`, `node nancheck.mjs <id>`,
`node render.mjs <id...>`, and `python3 assemble.py --name video --clean`. Set
`DOC2VID_OFFLINE=1` for silent, network-free narration and music tests. See
`template/STORYBOARD_SCHEMA.md`, `template/KIT.md`, and `template/prompts/README.md` for the
agent contract.
