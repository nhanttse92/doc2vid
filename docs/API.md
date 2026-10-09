# doc2vid service API

The job service runs on the Mac mini at `127.0.0.1:8790`. The albini-lab Worker exposes it to the
browser under `https://albinilabs.com/api/doc2vid/*`: it strips the `/api/doc2vid` prefix, checks the
viewer is the owner, and forwards the request with an `x-doc2vid-key` header. Paths below are origin
paths; the browser prefixes them with `/api/doc2vid`.

Every request except `GET /health` must carry `x-doc2vid-key: <ORIGIN_KEY>`; otherwise 401.
Errors are JSON: `{"error": "<code>", "message": "<human sentence>"}`.

## Endpoints

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/health` | | `{ok, version, queue: {running: jobId or null, waiting: n}}` |
| POST | `/jobs` | multipart: `file` (required), `prompt`, `minutes`, `title` | 201 `{job: JobSummary}` |
| GET | `/jobs` | | `{jobs: JobSummary[]}`, newest first, at most 50 |
| GET | `/jobs/:id` | | `{job: JobDetail}` |
| GET | `/jobs/:id/events` | | Server-Sent Events, see below |
| POST | `/jobs/:id/messages` | JSON `{text}` | 202 `{ok: true}`; 409 `{error: "busy"}` while queued or running |
| POST | `/jobs/:id/cancel` | | `{ok: true}` |
| GET | `/jobs/:id/files/:name` | | the file; supports `Range` |

`POST /jobs` fields:
- `file`: `.pdf`, `.doc`, `.docx`, `.rtf`, `.odt`, `.txt` or `.md`, at most 50 MB. Errors: `bad_file`, `too_large`.
- `prompt`: optional instructions, at most 4000 characters (audience, tone, what to emphasise).
- `minutes`: `2`, `5`, `10` or `20`; default `5`. Error: `bad_minutes`.
- `title`: optional, at most 120 characters; defaults to the file name without extension.
- `agent`: `sdk` (default; Claude Agent SDK sessions, scenes in parallel) or `channel` (owner-only debugging path: one long-lived interactive Claude Code session fed through the doc2vid channel, scenes one at a time). Error: `bad_agent`.

File names for `/files/:name`: `video.mp4`, `video.srt`, `video.vtt`, `storyboard.json`, `original`
(the upload, served with its original file name in `content-disposition`). Anything else is 404.

### JobSummary
```json
{
  "id": "j_20261008_ab12cd",
  "title": "Forklift safety",
  "status": "queued | running | done | failed | cancelled",
  "stage": "extract | storyboard | narrate | timing | music | scenes | assemble | revise | null",
  "minutes": 5,
  "agent": "sdk | channel",
  "created": "2026-10-08T22:10:00Z",
  "updated": "2026-10-08T22:31:12Z",
  "queuePosition": null,
  "inputName": "forklift-safety.docx",
  "hasVideo": true,
  "durationSeconds": 297.4
}
```

### JobDetail
JobSummary plus:
- `prompt`: the original prompt text.
- `stages`: `[{name, state: "pending | running | done | failed | skipped", started, finished}]`.
- `scenes`: `[{id, title, state: "pending | writing | rendering | done | fallback | failed"}]`, empty until the storyboard exists.
- `files`: `[{name, size}]` for the names above that exist.
- `lastSeq`: sequence number of the last event.

## Events

`GET /jobs/:id/events` replays the job's whole event log, then streams new events live. To resume, send
`Last-Event-ID: <seq>` (EventSource does this on reconnect) or `?after=<seq>`; only events with a larger
`seq` are sent. Each message is `id: <seq>` plus one `data:` line holding the event JSON; there are no
named SSE events, so `EventSource.onmessage` receives everything. The server sends `: ping` every 15 s
and `retry: 3000` once. The stream stays open after the job finishes, because a follow-up message can
start new work.

Every event has `seq` (1, 2, 3 …), `ts` (ISO time) and `type`:

| type | fields | meaning |
|---|---|---|
| `status` | `status`, `queuePosition` | job status changed |
| `user` | `text`, `file` (upload name, first message only) | the owner's prompt or follow-up |
| `stage` | `stage`, `state`: `start`, `done`, `failed`, `skipped`; `detail` | pipeline stage changed |
| `progress` | `stage`, `done`, `total` | for `scenes`: scenes finished out of total |
| `say` | `msg`, `role`: `storyboard` or `revise`, `delta` | assistant chat text; append `delta` to the bubble with id `msg` |
| `activity` | `role`: `storyboard`, `scene`, `revise`; `scene`; `text` | one-line summary of a tool call, e.g. `s02 · Edit web/scenes/s02.js` |
| `log` | `stage`, `text` | a line of pipeline script output (throttled) |
| `file` | `name`, `size`, `url` | an output file is ready; `url` is relative to the job, e.g. `files/video.mp4` |
| `error` | `stage`, `message` | something failed; the job may still continue (e.g. a scene fell back) |
| `done` | `durationSeconds` | the video is finished |

Only `storyboard` and `revise` agents produce `say` events; scene agents only produce `activity`.
