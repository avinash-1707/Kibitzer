# Kibitzer — UX Flow

> **The mobile app is the primary interface.** These flows lead with the phone; the web
> dashboard (later in this doc) is a secondary big-screen view. App screen specs and the
> SSE/audio/pairing implementation are in `mobile-app.md`.

## Primary flow (the builder, on the phone)
1. Install the adapter for whichever CLI they're using (one file drop — `.claude/settings.json`
   entry, `.opencode/plugins/kibitzer.ts`, or a `notify` line in `~/.codex/config.toml`).
   Exact configs and field mappings live in `event-schema.md`.
2. Start the backend; it prints a **pairing QR** (a public tunnel URL). Open the Kibitzer app
   and scan it — the phone is now connected to the running session over the tunnel.
3. Start coding as normal, phone propped up. On the **Feed** screen, narrated lines stream in
   with audio auto-playing on-device (queued, not overlapping). The drama meter reacts on
   risky moments; a spike animates the feed (no OS push in this build).
4. Swipe to **Analytics** any time to see what actually happened — tool-call breakdown, files
   touched, test pass/fail, backtracks, risk log.
5. When done, tap **"Wrap up session"** (`POST /session/:id/end`) — the devpost draft is
   generated from the full transcript and shown, ready to copy/share. (No reliable per-CLI
   "whole session finished" signal exists, so this is an explicit action — see
   `architecture.md` §8.)

The Feed reads from one `react-native-sse` `EventSource('<tunnel>/events/stream')`
connection; Analytics fetches `GET /session/:id/analytics` separately. Endpoints are
specified in `api-reference.md`; app details in `mobile-app.md`.

## Mobile app (PRIMARY interface, Expo)

Runs installed on-device (not Expo Go), connected to the backend over a public tunnel.
Screen-by-screen implementation, navigation, the SSE hook, and the audio queue are in
`mobile-app.md`; this section is the UX intent.

### Pairing (first screen)
- Scan the QR the backend prints on boot (encodes the tunnel URL, e.g.
  `https://xyz.trycloudflare.com`), or paste it. That URL is stored and used as the base for
  all requests. No accounts, no auth — single-session demo.
- Once paired, the app opens the **Feed** and connects `EventSource('<base>/events/stream')`.

### Feed (home, default)
- Stories-style vertical timeline, newest at top, rendered from `replay` + `narration` SSE
  frames.
- Persistent **drama meter** at the top (0–100, calm green → hot red), updated live from the
  `score` frame (which arrives before the narration text — the meter reacts first).
- Each card: narrated line, a drama-color strip, a **play button** that plays
  `<base>/api/tts?eventId=…` on-device (queued so lines don't overlap — see `mobile-app.md`).
  Timestamp + source badge (Claude Code / OpenCode / Codex).
- Tap a card to expand: full narration, audio auto-plays, and a "what actually happened"
  technical line (from `describeEvent()`, mirroring the Analytics risk log, one event at a
  time).

### Analytics (swipe/tab)
- Data source: `GET /session/:id/analytics`, fetched on mount and polled every ~5s (uses the
  `sessionId` from the SSE `hello` frame). Separate from the feed — analytics counts include
  `Read`/duplicate events the feed omits, so they can't be derived client-side.
- Native summary cards: total tool calls, files touched, test pass/fail, session duration,
  backtrack count. A `toolCallsByType` breakdown (simple native bars or a list of counts).
- Files-touched list (`filesTouched`, most-edited first) and a **risk log** (`riskLog`,
  dramaScore ≥ 55) each shown as a plain `logLine` so a technical judge can cross-reference
  what caused a spike.

### Session controls
- Persona choice → `PUT /persona` (affects future narration only).
- **"Wrap up session"** → `POST /session/:id/end`, then shows the devpost/tweet draft to
  copy/share.

## Web dashboard (SECONDARY — big-screen / judge view)

Same backend, same endpoints — a desk/projector view, built only after the app works. Two
tabs, identical data:
- **Commentary** — `EventSource('/events/stream')`; feed + drama meter + persona switcher +
  inline `<audio src="/api/tts?eventId=…">`.
- **Analytics** — `GET /session/:id/analytics` (fetch on mount + 5s poll); summary cards,
  `toolCallsByType`, files-touched list, risk log.

Tab switch is instant (Commentary from SSE, Analytics owns its own poll). This mirrors the
app one-to-one so the pitch can show either screen.

## Demo-day flow (what a judge sees)
1. The **phone** is propped up, already paired and narrating live — feed scrolling, audio
   playing on-device, drama meter moving.
2. Presenter explains the pitch in ~20 seconds while a line or two narrates naturally.
3. Hand the judge the phone; they swipe to **Analytics** — "same stream, a real audit log,
   not just jokes."
4. (If the dashboard is up on a screen) the same session is mirrored big for the room.
5. Tap **"Wrap up session"** — the devpost draft, generated from the session that just
   happened (including this demo), appears to copy.
