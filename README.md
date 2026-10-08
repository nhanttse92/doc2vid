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
