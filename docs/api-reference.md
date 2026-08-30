# Kibitzer — API Reference

All endpoints served by the single Bun + Hono process on `KIBITZER_PORT` (default 8787).
Canonical types are in `packages/shared/src/event.ts` (see `event-schema.md`). No auth
(localhost demo). All bodies are `application/json` unless noted.

---

## POST /events

Ingest one canonical `KibitzerEvent` (from the OpenCode / Codex adapters, or manual
checkpoints). Validated with zod; malformed → `400`.

**Request body:** a single `KibitzerEvent`.
```json
{
  "id": "a1b2c3d4-...",
  "sessionId": "sess-001",
  "source": "opencode",
  "type": "tool_call",
  "timestamp": "2026-08-30T11:42:03.120Z",
  "detail": { "tool": "Bash", "command": "npm test", "outcome": "failure" }
}
```

**Behaviour:** store synchronously, then `runPipeline(event)` **without await**.

**Response:** `202 Accepted`, body `{ "ok": true, "id": "<event id>" }`.
Errors: `400` `{ "error": "invalid event", "issues": [...] }`.

---

## POST /ingest/claude-code

Accepts a **raw Claude Code hook payload** (native `type: "http"` hook posts here). The
server normalizes it to canonical (mapping table in `event-schema.md`) then flows through the
same store + pipeline path as `/events`.

**Request body:** whatever Claude Code sends, e.g. a failed Bash tool call fires the
`PostToolUseFailure` hook (a successful one fires `PostToolUse`):
```json
{
  "session_id": "abc123",
  "hook_event_name": "PostToolUseFailure",
  "tool_name": "Bash",
  "tool_input": { "command": "npm test" }
}
```
`outcome` is derived from `hook_event_name` (see `event-schema.md`), not from any
`tool_response.success` field.

**Response:** always fast `2xx` (Claude Code fails open; never make it wait). `200`
`{ "ok": true }`. A body whose `hook_event_name` isn't mapped is stored with `raw` set and a
best-effort `type`, still returning `200`, so schema drift in Claude Code never breaks the
session.

---

## GET /events/stream

Server-Sent Events. The dashboard and push worker subscribe here.

**On connect:** sends a `hello` frame with the active `sessionId`, replays the ring buffer as
`replay` frames, then streams live frames. A `ping` heartbeat every 15s keeps the connection
open (see `architecture.md` §5 for the "don't resolve the callback early" gotcha).

**Frame kinds (`event:` field):**
| kind | `data` (JSON) | when |
|---|---|---|
| `hello` | `{ sessionId }` | once, on connect — dashboard uses it for `/session/:id/analytics` |
| `replay` | `FeedItem` | once per buffered item on connect |
| `score` | `{ eventId, dramaScore }` | after scoring (step 1) — meter reacts first |
| `narration` | `FeedItem` (audioUrl may be null) | after the LLM returns (step 3) |
| `audio` | `{ eventId, audioUrl }` | after TTS writes the mp3 (step 4) |
| `persona` | `{ persona }` | when persona changes |
| `ping` | `""` | 15s heartbeat, ignore |

```ts
interface FeedItem {
  event: KibitzerEvent;
  dramaScore: number;        // 0–100
  narration: string | null;  // null until LLM resolves
  audioUrl: string | null;   // "/api/tts?eventId=…" once TTS ready
}
```

The three live frames arrive in order per event (`score` → `narration` → `audio`); the
client merges them by `event.id` so the feed shows the meter, then text, then a play button,
without blocking on the slowest stage.

**Client:**
```js
const es = new EventSource("/events/stream");
es.addEventListener("hello", (e) => setSession(JSON.parse(e.data).sessionId));
es.addEventListener("replay", (e) => addToFeed(JSON.parse(e.data)));
es.addEventListener("narration", (e) => addToFeed(JSON.parse(e.data)));
es.addEventListener("score", (e) => updateMeter(JSON.parse(e.data)));
es.addEventListener("audio", (e) => attachAudio(JSON.parse(e.data)));
```

---

## GET /session/:id/analytics

Aggregates the store into the Analytics tab shape. Computed on demand from SQLite (the ring
drops `Read`/duplicate events that never narrate, so counts like `Read: 45` only exist in
the DB). The Analytics tab **fetches this on mount and polls every ~5s** — it is *not*
derivable from the SSE feed. The Commentary tab, by contrast, renders purely from SSE.

**Response `200`:**
```json
{
  "sessionId": "sess-001",
  "durationMs": 1843000,
  "toolCallsByType": { "Bash": 12, "Edit": 30, "Write": 8, "Read": 45 },
  "filesTouched": [
    { "path": "src/server/routes/events.ts", "editCount": 4 },
    { "path": "src/store.ts", "editCount": 2 }
  ],
  "tests": { "pass": 3, "fail": 2 },
  "backtrackCount": 2,
  "riskLog": [
    { "eventId": "…", "timestamp": "…", "logLine": "Bash `rm -rf dist` → success", "dramaScore": 90 }
  ]
}
```

- `backtrackCount` = count of files edited 3+ times (the backtrack heuristic).
- `tests.pass/fail` = Bash calls whose command matches a test runner (`test`, `vitest`,
  `jest`, `pytest`, `go test`, `cargo test`) grouped by `outcome`.
- `riskLog` = events with `dramaScore >= 55`, each `logLine` produced by `describeEvent()`
  (`persona-prompts.md`) — a pure formatter, **no LLM call** on analytics fetch — so a
  technical judge can cross-reference spikes.

---

## POST /session/:id/end

Runs the devpost generator over the full transcript and returns
`{ post, tweetThread }`, caching it on the `sessions` row. **Explicit trigger only** (the
dashboard's "Wrap up session" button) — not auto-fired, because OpenCode/Codex session-end
signals are per-turn (see `architecture.md` §8). A re-POST regenerates.

**Response `200`:** `{ "post": "…", "tweetThread": ["…", "…"] }`.

## GET /session/:id/devpost

Returns the cached devpost. `404` `{ "error": "not generated yet" }` if the session hasn't
been wrapped up.

---

## GET /persona  •  PUT /persona

Global persona state (single-session demo — held in memory, not per-session).

- `GET` → `{ "persona": "sports" }`
- `PUT` body `{ "persona": "nature" }` → `200 { "persona": "nature" }`, broadcasts a
  `persona` SSE frame. Persona change affects **future** narration only (no retroactive
  regeneration — avoids mid-demo lag).

Valid values: `"sports" | "nature"` (see `persona-prompts.md`).

---

## GET /api/tts?eventId=…

Returns `audio/mpeg` for a narrated line. Serves the cached
`packages/server/public/audio/<eventId>.mp3` if present, else generates via ElevenLabs,
caches, and streams. `404` if the event has no narration.

Used as `<audio src="/api/tts?eventId=…">` in the dashboard.

---

## Push notifications — CUT for this build

No `/push/register` endpoint. Remote push needs an Expo dev build with FCM/APNs credentials
(lead time we don't have). The app is installed on-device and pulls the live feed over the
tunnel instead; a drama spike animates **in-feed** (driven by the `score` SSE frame), not via
an OS notification. If push is added later, it's a `POST /push/register` + a worker that sends
to registered tokens when `dramaScore >= 60`.

---

## Pairing / tunnel (how the app reaches the backend)

There is no pairing *endpoint* — pairing is a client concern. The backend is exposed via an
**ngrok** tunnel (`ngrok http 8787`) so the phone reaches it on any network; the tunnel URL is
rendered as a QR on boot. The app scans it and uses it as the base URL for every call below
(`<base>/events/stream`, `<base>/api/tts?…`, `<base>/session/:id/analytics`, …). See
`mobile-app.md` for the app side.

> **Why ngrok, not a Cloudflare quick tunnel:** Cloudflare quick tunnels explicitly do NOT
> support Server-Sent Events (per CF docs), and the live feed is SSE — a quick tunnel would
> silently break `/events/stream`. ngrok proxies SSE fine (needs a free authtoken once). A
> named/authenticated Cloudflare Tunnel also works if you prefer CF.

> **CORS:** since every app request goes to `<base>` (same origin from the device's view), no
> CORS config is needed for the app. The **web dashboard** in dev still needs the Vite proxy
> (see README). If the dashboard is ever served cross-origin, enable Hono's `cors()`.

---

## Error conventions
- `400` — invalid request body (zod issues included).
- `404` — unknown session/event.
- `5xx` — unexpected; the pipeline never surfaces LLM/TTS failures here (it degrades to
  templated text / text-only), so a `5xx` on `/events` means the *store* failed, which is a
  real bug worth failing loudly on.
