# Kibitzer

Live voice commentary and analytics for AI coding-agent sessions (Claude Code, OpenCode,
Codex) — **delivered as a mobile app**. Point it at an agent session and watch a narrated,
spoken-aloud feed on your phone, with an analytics/audit view of what the agent actually did.

See `docs/project-overview.md` for the pitch, `docs/architecture.md` for the system design,
`docs/mobile-app.md` for the app (the primary interface).

## Docs map (`docs/`)

| Doc | What's in it |
|---|---|
| `project-overview.md` | Problem, solution, scope, differentiators |
| `architecture.md` | System design, folder layout, DB schema, env vars, tech stack |
| `mobile-app.md` | **Primary interface** — app screens, SSE hook, audio queue, pairing |
| `event-schema.md` | Canonical event + **verified** per-adapter field mappings + adapter configs |
| `api-reference.md` | Every endpoint's request/response contract + SSE frame shapes |
| `persona-prompts.md` | Persona system prompts, narration LLM call, drama-meter pure fn |
| `ux-flow.md` | App screens (primary) + dashboard (secondary), tied to endpoints |
| `build-plan.md` | 3-hour, app-primary build plan with acceptance checks |
| `work-units.md` | Independent work units (disjoint files + frozen contracts) for parallel sessions |

## Prerequisites
- [Bun](https://bun.sh) (runtime; ships `bun:sqlite` + `fetch`)
- An [OpenRouter](https://openrouter.ai) API key and an [ElevenLabs](https://elevenlabs.io)
  API key (free tier: 10k credits/mo)
- One of: Claude Code, OpenCode, or Codex CLI installed, to generate events
- [ngrok](https://ngrok.com) (free account + authtoken) — exposes the backend to the phone
  over an SSE-capable tunnel. **Cloudflare quick tunnels do not work** (no SSE support).
- Expo + an **installed dev build** on your device (`npx expo run:ios` / `run:android`) — the
  app is installed, not run in Expo Go. (Push is not used, so no FCM/APNs setup needed.)

## Setup

```sh
bun install            # installs zod, hono, and workspace deps
cp .env.example .env   # then fill in the two API keys
ngrok config add-authtoken <token>   # once
```

`.env`:
```
KIBITZER_PORT=8787
KIBITZER_DB=kibitzer.sqlite
KIBITZER_ENDPOINT=http://localhost:8787/events
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_NARRATION_MODEL=meta-llama/llama-3.1-8b-instruct
OPENROUTER_DEVPOST_MODEL=google/gemini-2.5-flash
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
```

## Run

```sh
bun run packages/server/src/index.ts   # backend on :8787
ngrok http 8787                         # prints the public tunnel URL (the app's base)
bun test                               # drama/classify unit tests
```

Then launch the installed app, scan the pairing QR (encodes the ngrok URL), and the Feed
connects over the tunnel. App details: `docs/mobile-app.md`.

### Secondary: web dashboard (optional, big-screen view)
```sh
bun run --cwd apps/dashboard dev        # Vite on :5173, talks to localhost:8787
```
The dashboard (:5173) and server (:8787) are different ports, so relative URLs need a dev
proxy in `apps/dashboard/vite.config.ts`:
```ts
export default defineConfig({
  server: {
    proxy: {
      "/events":  "http://localhost:8787",
      "/session": "http://localhost:8787",
      "/persona": "http://localhost:8787",
      "/api":     "http://localhost:8787",
    },
  },
});
```

## Wire up an adapter (pick your CLI)

**Claude Code** — copy `adapters/claude-code/settings.json` into the target repo's
`.claude/settings.json` (native `type: "http"` hooks; no script needed). See
`docs/event-schema.md` § Claude Code.

**OpenCode** — copy `adapters/opencode/kibitzer.ts` into the target repo's
`.opencode/plugins/kibitzer.ts` (directory is **plural**). See `docs/event-schema.md`
§ OpenCode.

**Codex** — add to `~/.codex/config.toml` (user-level only; ignored in a project
`.codex/config.toml`):
```toml
notify = ["/usr/bin/env", "node", "/abs/path/to/kibitzer/adapters/codex/notify.js"]
```
See `docs/event-schema.md` § Codex.

## Verify the pipe
1. Start the server + `ngrok http 8787`. `curl -N <ngrok-url>/events/stream` should hold open.
2. Run your agent; do a `Bash`/`Edit`. A normalized `KibitzerEvent` should appear as
   `score`→`narration`→`audio` SSE frames within ~2–3s.
3. On the phone (paired via QR), the line renders in the Feed with audio playing on-device.

## Notes
- Single-session demo tool — **no auth**. The ngrok tunnel makes the backend briefly public;
  fine for a demo (random short-lived URL), but add a shared-secret header before running the
  tunnel against a real codebase.
- No dependency failure should break the demo: LLM down → templated narration; TTS down →
  text-only; server down → adapters swallow the POST error (Claude Code hooks fail open).
- Push notifications are cut this build (needs a credentialed dev build); drama spikes animate
  in-feed instead.
