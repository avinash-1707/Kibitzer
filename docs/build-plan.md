# Kibitzer — Build Plan (3-hour, app-primary)

**Target: a phone showing a live narrated feed with on-device audio + an analytics view,
paired to the backend over ngrok.** The web dashboard is NOT on the critical path — build it
only if the app is done early.

> **Reality check.** Three hours for a backend *and* a native app is aggressive. This plan
> gets there by (a) keeping the backend to the thinnest slice that feeds the app, (b) one
> persona, (c) cutting the dashboard, OpenCode/Codex adapters, and push from the critical
> path. If you fall behind, the ladder in "Cut list" keeps a working demo at every step. Have
> the ngrok authtoken and Expo dev build tooling ready *before* the clock starts.

## Pre-flight (before the 3h clock — ~15 min)
- `ngrok config add-authtoken <token>` (free account; required once). Confirm
  `ngrok http 8787` prints a public URL.
- Expo: `npx create-expo-app apps/mobile`; make an **installed dev build** on your device
  (`npx expo run:ios` / `run:android`) so you're not fighting the build during the window.
- Backend: `bun init` workspaces `packages/shared`, `packages/server`, `apps/mobile`;
  `bun add zod hono`; `.env` with `OPENROUTER_API_KEY` + `ELEVENLABS_API_KEY`.
- Claude Code sanity check: does the installed build fire `PostToolUseFailure`/`StopFailure`?
  (`claude --version` + hooks doc.) If not, fall back to `PostToolUse` only.
- **Done when:** ngrok tunnels a hello-world Bun server and the app dev build launches on the
  phone.

## Hour 1 — Backend event→narration→audio→SSE (all of it)
Compress the old Hours 1–4 backend work into one focused hour; the app needs the full chain.
- `packages/shared`: `event.ts` (types + zod), `classify.ts` (`isDestructive`), `drama.ts`
  (`dramaScore` + `shouldNarrate`), `describe.ts` (`describeEvent` + `templatedFallback`).
  One `bun test` for `drama`/`classify`.
- `packages/server`: `store.ts` (`bun:sqlite` WAL + `FeedItem[]` ring), `bus.ts`
  (`Set<SSEStreamingApi>` + `broadcast`), `pipeline.ts` (classify→score→debounce→narrate→tts,
  broadcasting `score`→`narration`→`audio`), `narrate.ts` (OpenRouter, `sports` persona),
  `tts.ts` (ElevenLabs Flash → `public/audio/<id>.mp3`).
- Routes: `POST /ingest/claude-code`, `GET /events/stream` (hello→replay→heartbeat, mind the
  "don't resolve early" gotcha), `GET /api/tts`, `GET /session/:id/analytics`,
  `GET`/`PUT /persona`.
- `adapters/claude-code/settings.json` — native http hooks.
- **Done when:** with `curl -N <ngrok>/events/stream` open, a real Claude Code tool call
  streams `score`→`narration`→`audio` frames within ~2–3s, and `<ngrok>/api/tts?eventId=…`
  plays audio in a browser. This is the app's entire contract — verify it over the tunnel,
  not just localhost.

## Hour 2 — App: pairing + live feed + audio (the hero screen)
- `src/base.ts` (SecureStore), `src/useEventStream.ts` (`react-native-sse`, named events →
  handlers), `src/audioQueue.ts` (`expo-audio`, ONE reused player via `.replace()` — never a
  player-per-clip; see `mobile-app.md`), `src/store.ts` (merge frames by `event.id`).
- **Pairing screen:** QR scan (`expo-camera`) / paste → validate with `GET <base>/persona` →
  store → route to Feed.
- **Feed screen:** drama meter (from `score`), card list (narration + drama strip + play),
  auto-enqueue audio on `audio` frames, persona control.
- **Done when:** phone scans the QR, connects over ngrok, and shows narrated lines appearing
  live with audio playing on-device, one at a time. **This is the minimum viable demo** — if
  you stop here, you still have a pitch.

## Hour 3 — App: analytics + wrap-up, then polish
- **Analytics screen:** `GET <base>/session/:id/analytics` on mount + 5s poll (`sessionId`
  from the `hello` frame). Native summary cards + risk log + a simple `toolCallsByType`
  breakdown (list of counts is 10 min; skip a chart lib under time pressure).
- **Wrap-up:** `devpost.ts` + `POST /session/:id/end` on the backend; a "Wrap up session"
  button in the app shows the draft. (Explicit trigger only — not auto-fired; see
  `architecture.md` §8.)
- Point Kibitzer at your **own** build session so the demo narrates itself.
- **Done when:** the app shows Feed + Analytics + a devpost draft, all live over the tunnel.
  Fix demo-breaking bugs only — no new features.

## Demo prep — remaining time
- Rehearse the ~60s pitch (below).
- **Confirm pairing works on the venue Wi-Fi** before walking up — ngrok makes this network-
  independent, but test the actual QR→connect→audio path on the phone you'll demo with.

## Cut list (drop bottom-up if behind — each level still demos)
1. Web dashboard — **already off the critical path**; only build if Hour 3 finishes early.
2. OpenCode / Codex adapters — Claude Code alone proves the concept; mention agent-agnostic
   design as a talking point (the schema/adapters are specced in `event-schema.md`).
3. Devpost generator — nice closing beat; cut before the app itself.
4. Analytics screen — Feed + audio alone is a complete "watch your agent" pitch.
5. Second persona — you're shipping one anyway.

**Never cut:** Claude Code adapter, the narration+TTS pipeline, ngrok pairing, the app Feed
with on-device audio. That chain *is* the product.

## Fallbacks (don't let one failure sink the demo)
- ngrok flaky at the venue → the app also accepts a pasted LAN URL (`http://<mac-ip>:8787`) if
  Wi-Fi allows; keep the dashboard on the Mac as an ultimate fallback screen.
- `expo-audio` misbehaving → the feed still shows text; audio is additive, not load-bearing.
- LLM slow/unreachable → `templatedFallback` keeps lines flowing; TTS failure → text-only.

## Demo script (~60 seconds)
1. **Hook (10s):** "Agentic coding is a black box. Kibitzer turns your agent's session into a
   live show you watch on your phone." Phone already paired and narrating.
2. **Show (20s):** let a narrated line land with audio out of the phone speaker; the drama
   meter jumps on a test failure.
3. **Audit (15s):** hand the judge the phone, swipe to Analytics — "same stream, a real audit
   log of what the agent actually did."
4. **Agent-agnostic (10s):** "One event schema behind this — Claude Code today, OpenCode and
   Codex drop in the same way."
5. **Close (5s):** tap "Wrap up session" — "and it just wrote its own devpost."
