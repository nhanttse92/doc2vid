# doc2vid job service

This Node 22+ service listens on `127.0.0.1:8790` and runs one document-to-video job at a time. The origin API is specified in [docs/API.md](../docs/API.md). Jobs and their event logs live under `~/doc2vid-data/jobs/` by default.

## Run locally

```sh
cd server
npm ci
ORIGIN_KEY=dev DOC2VID_FAKE_AGENT=1 node src/server.mjs
```

`GET /health` needs no key; every other endpoint requires `x-doc2vid-key`. The fake agent uses a small test storyboard. A full video still needs the template prompts, tools and rendering dependencies. Run tests with `cd server && node --test`.

## Mac mini setup

From the laptop run `deploy/push.sh` (set `DOC2VID_HOST` to override the SSH target). On the Mac mini, `deploy/install.sh` installs dependencies and LaunchAgents. Put `ORIGIN_KEY=<secret>` in `~/.config/doc2vid/server.env` and set that file to mode `0600` before starting the service. The installer neither creates nor prints secrets. Put `OPENROUTER_API_KEY=<secret>` in `~/.config/doc2vid/env` (also mode `0600`) for narration and music. The key is supplied only to those scripts.

The service uses the local Claude CLI login by default. To use API-key billing instead, set `ANTHROPIC_API_KEY` in `~/.config/doc2vid/server.env`. The server passes it unchanged to the Claude Agent SDK.

Configuration defaults: `HOST=127.0.0.1`, `PORT=8790`, `DOC2VID_HOME=~/doc2vid-data`, `TEMPLATE_DIR=<repo>/template`, `OPENROUTER_ENV_FILE=~/.config/doc2vid/env`, `CLAUDE_PATH=~/.local/bin/claude`, `STORYBOARD_MODEL=claude-opus-5-5`, `SCENE_MODEL=claude-opus-5-5`, `SCENE_CONCURRENCY=3`, `RENDER_JOBS=4`, `MAX_UPLOAD_MB=50`, `AGENT_SANDBOX=0`. `ORIGIN_KEY` is required. `DOC2VID_FAKE_AGENT=1` uses the deterministic test agent; `DOC2VID_OFFLINE=1` is forwarded to the template scripts.

LaunchAgent logs are at `~/Library/Logs/doc2vid/stdout.log` and `stderr.log`. The awake agent runs `caffeinate -dimsu`.
