# Kibitzer — Independent Work Units

This splits the build into units that can each be done in a **separate session** without
seeing another unit's code. Two guarantees make that possible:

1. **Disjoint file ownership.** No two units edit the same file. The ownership table below is
   the source of truth — if you're about to touch a file another unit owns, stop.
2. **Frozen contracts, not shared code.** A unit codes against *interfaces* (types, function
   signatures, endpoint + SSE shapes) that are fixed up front in **Unit 0**. A unit never
   needs to read another unit's implementation — only the contract, which lives in the docs
   (`event-schema.md`, `api-reference.md`, `persona-prompts.md`) and in Unit 0's stubs.

> **The load-bearing idea:** Unit 0 lays down the *entire file skeleton* — every file exists
> as a typed stub that compiles (`bunx tsc --noEmit` clean) — plus the real shared package and
> the state layer. Every later unit then only **edits files that already exist and are
> exclusively theirs**. No unit creates a file another unit imports; the import already
> resolves to a stub. This is what removes the cross-session coupling.

---

## Dependency graph

```
                    ┌─────────────────────────┐
                    │  UNIT 0 — Foundation     │  (must land first, alone)
                    │  shared + state + skeleton│
                    └────────────┬─────────────┘
                                 │ freezes all contracts
        ┌──────────┬─────────────┼─────────────┬──────────┬──────────┐
        ▼          ▼             ▼             ▼          ▼          ▼
   ┌─────────┐┌─────────┐  ┌──────────┐  ┌─────────┐┌─────────┐┌─────────┐
   │ A       ││ B       │  │ C        │  │ E       ││ F       ││ I       │
   │Pipeline ││Ingest+  │  │Analytics+│  │OpenCode+│  │App infra││Dashboard│
   │+voice   ││stream   │  │devpost   │  │Codex    ││+pairing ││(secondary)
   └─────────┘└────┬────┘  └──────────┘  │adapters ││    │    │└─────────┘
                   │(owns CC adapter)     └─────────┘│    │
                   └── D folded into B                │    │ freezes app-side API
                                             ┌────────┴────┴────────┐
                                             ▼                      ▼
                                        ┌─────────┐            ┌─────────┐
                                        │ G       │            │ H       │
                                        │App Feed │            │App      │
                                        │screen   │            │Analytics│
                                        └─────────┘            └─────────┘
```

**Wave 1 (after Unit 0):** A, B, C, E, F, I — fully parallel, disjoint files.
**Wave 2 (after Unit F):** G, H — depend only on F's frozen app-side interfaces.
**Last:** Unit Z — integration/wiring/verify (owns only glue: `.env`, run scripts).

---

## File-ownership table (the anti-collision contract)

| Unit | Owns (edits) these files, and only these |
|---|---|
| **0** | `package.json`, `packages/shared/src/*` (real), `packages/server/src/store.ts`, `bus.ts`, `index.ts`, and **empty typed stubs** for every file below |
| **A** | `packages/server/src/pipeline.ts`, `narrate.ts`, `personas.ts`, `tts.ts`, `routes/tts.ts` |
| **B** | `packages/server/src/routes/events.ts`, `routes/stream.ts`, `routes/persona.ts`, `packages/server/src/normalize/claude-code.ts`, `adapters/claude-code/settings.json` |
| **C** | `packages/server/src/routes/analytics.ts`, `routes/devpost.ts`, `devpost.ts` |
| **E** | `adapters/opencode/kibitzer.ts`, `adapters/codex/notify.js` |
| **F** | `apps/mobile/src/base.ts`, `useEventStream.ts`, `audioQueue.ts`, `store.ts`, `api.ts`, `apps/mobile/app/index.tsx`, `apps/mobile/app/_layout.tsx` |
| **G** | `apps/mobile/app/feed.tsx` (+ any `apps/mobile/src/components/feed/*`) |
| **H** | `apps/mobile/app/analytics.tsx`, `apps/mobile/app/devpost.tsx` (+ `components/analytics/*`) |
| **I** | `apps/dashboard/**` (entire workspace) |
| **Z** | `.env.example`, root run scripts, `README` run section only |

No file appears in two rows. That is the whole point.

> A few files here refine `architecture.md`'s layout for clean ownership:
> `normalize/claude-code.ts` (the raw→canonical mapper, split out of `routes/events.ts` so
> Unit B owns ingestion whole) and `app/devpost.tsx` + `src/components/**` (screen
> subcomponents). These are additive — no conflict with the specs.

---

## Unit 0 — Foundation (prerequisite, do first, alone)

**Goal:** freeze every contract and make the repo compile end-to-end with stubs, so all other
units are unblocked and mutually independent.

**Build:**
- Bun workspaces `package.json` (`["packages/*", "apps/*"]`); `bun add zod hono`.
- **Real** `packages/shared/src/`: `event.ts` (types + zod), `classify.ts` (`isDestructive`),
  `drama.ts` (`dramaScore`, `shouldNarrate`), `describe.ts` (`describeEvent`,
  `templatedFallback`) — all fully specified in `event-schema.md` + `persona-prompts.md`.
  Ship their unit tests (`bun test`).
- **Real** state layer `packages/server/src/store.ts` (`saveEvent`, `updateEvent`,
  `pushFeedItem`, `getRing`, `activeSessionId`, `recentBefore` + the SQLite DDL) and `bus.ts`
  (`addClient`, `removeClient`, `broadcast`) — signatures from `architecture.md` §3, §5.
- **Skeleton** `packages/server/src/index.ts`: `Bun.serve` + Hono, mounting **every** route
  module (`events`, `stream`, `analytics`, `tts`, `devpost`, `persona`) up front. Each route
  file exists as a stub exporting a Hono router that returns `501 Not Implemented`.
- **Stubs** (compile, return 501 / throw "not implemented") for every file in the ownership
  table: `pipeline.ts`, `narrate.ts`, `personas.ts`, `tts.ts`, `devpost.ts`,
  `normalize/claude-code.ts`, and the `routes/*` handlers.
- App skeleton: `apps/mobile` created (`create-expo-app`), `app/_layout.tsx` registering
  `index`/`feed`/`analytics`/`devpost` screens as stubs; `apps/dashboard` scaffolded empty.

**Freeze & publish (this is the deliverable other units read):** a short
`docs/contracts.md`-style comment block OR just rely on the exported TypeScript signatures —
every downstream unit imports types/functions from `packages/shared` and `store.ts`/`bus.ts`
and reads endpoint/SSE shapes from `api-reference.md`. Do not change these after Wave 1 starts.

**Done when:** `bunx tsc --noEmit` is clean across the workspace; `bun test` passes for
shared; `bun run packages/server/src/index.ts` boots and every route returns 501; the mobile
app launches to a stub screen.

---

## Wave 1 units (parallel, independent)

### Unit A — Narration pipeline + voice
**Owns:** `pipeline.ts`, `narrate.ts`, `personas.ts`, `tts.ts`, `routes/tts.ts`.
**Codes against (frozen, do not edit):** `shared/drama`, `shared/describe`, `shared/classify`;
`store.updateEvent`/`pushFeedItem`/`recentBefore`; `bus.broadcast`; persona prompts +
narration call shape (`persona-prompts.md`); pipeline stage order + SSE frames
(`architecture.md` §4, `api-reference.md`).
**Build:** `runPipeline(event)` = classify→score→debounce→narrate→tts, broadcasting
`score`→`narration`→`audio`; OpenRouter + ElevenLabs calls with the specified fallbacks;
`GET /api/tts` cache-first audio proxy.
**Done when:** feeding a fake `KibitzerEvent` through `runPipeline` broadcasts the three frames
in order and writes `public/audio/<id>.mp3`; `/api/tts?eventId=…` serves it. (Test with a
hand-built event object — no need for the real ingestion route.)

### Unit B — Ingestion + streaming + persona
**Owns:** `routes/events.ts`, `routes/stream.ts`, `routes/persona.ts`,
`normalize/claude-code.ts`, `adapters/claude-code/settings.json`.
**Codes against (frozen):** `store.saveEvent`/`getRing`/`activeSessionId`; `bus.add/remove`;
`runPipeline` **signature only** (from A's stub — call it, don't read it); event zod schema;
`/ingest/claude-code` mapping table + SSE `hello`/`replay`/`ping` order (`event-schema.md`,
`api-reference.md`).
**Build:** `POST /events` (zod-validate → `saveEvent` → fire-and-forget `runPipeline` → 202);
`POST /ingest/claude-code` (normalize via `normalize/claude-code.ts` → same path);
`GET /events/stream` (hello→replay→heartbeat, mind the "don't resolve early" gotcha);
`GET`/`PUT /persona`.
**Done when:** POSTing a canonical event returns 202 and appears on a `curl -N /events/stream`
as a `replay`/live frame; a raw Claude Code payload to `/ingest/claude-code` normalizes
correctly (unit-test the normalizer with the sample payloads in `event-schema.md`).

### Unit C — Analytics + devpost
**Owns:** `routes/analytics.ts`, `routes/devpost.ts`, `devpost.ts`.
**Codes against (frozen):** `store.getRing` + SQLite read; `shared/describe` for risk-log
lines; analytics response shape + devpost trigger rules (`api-reference.md`,
`architecture.md` §8).
**Build:** aggregation for `GET /session/:id/analytics` (tool-call counts, files touched,
tests, backtracks, risk log — all from stored events, incl. Reads the feed omits); one-shot
transcript summariser for `POST /session/:id/end` + cached `GET /session/:id/devpost`.
**Done when:** with a seeded SQLite DB, `/session/:id/analytics` returns the documented shape
and `/session/:id/end` produces `{ post, tweetThread }`. Independent of the live pipeline.

### Unit E — OpenCode + Codex adapters
**Owns:** `adapters/opencode/kibitzer.ts`, `adapters/codex/notify.js`.
**Codes against (frozen):** the canonical event shape + per-adapter mappings
(`event-schema.md`) — **nothing else**. These files are self-contained (they run in *other*
repos and cannot import `packages/shared`).
**Build:** the two adapters exactly as specified, POSTing canonical events to `/events`.
**Done when:** running each adapter against a throwaway session POSTs well-formed canonical
events (verify against a local echo server or the real `/events` if B is up — but the unit
doesn't require B; a `nc`/echo target suffices).

### Unit F — App infrastructure + pairing (app foundation)
**Owns:** `apps/mobile/src/{base,useEventStream,audioQueue,store,api}.ts`,
`app/index.tsx` (pairing), `app/_layout.tsx`.
**Codes against (frozen):** SSE frame names + `FeedItem`/analytics shapes (`api-reference.md`);
`react-native-sse` + `expo-audio` usage (`mobile-app.md`).
**Build:** `base.ts` (SecureStore), `useEventStream` hook (named events → handlers),
`audioQueue` (one reused player), app-side `store` (merge frames by `event.id`, expose
selectors), `api.ts` (analytics/persona/wrap-up fetchers), pairing screen (QR/paste → store →
route), `_layout` registering all screens.
**Freeze & publish (Wave-2 reads this):** the app-side interfaces — `useEventStream`
signature, `audioQueue.enqueue`, and the store's selectors/actions. Fix these before G/H start.
**Done when:** the app pairs to a URL, connects `useEventStream`, and the store receives
frames (log them); audio queue plays a test URL on-device without overlap.

### Unit I — Web dashboard (secondary, fully parallel)
**Owns:** `apps/dashboard/**`.
**Codes against (frozen):** the endpoints + SSE frames only (`api-reference.md`, `ux-flow.md`).
Does **not** depend on Unit F (own SSE via browser `EventSource`).
**Build:** Commentary tab (`EventSource('/events/stream')`), Analytics tab (`/session/:id/
analytics`, mount + 5s poll), Vite proxy (README). Lowest priority — build only if capacity.
**Done when:** against a running backend, both tabs render live.

---

## Wave 2 units (after Unit F freezes app-side interfaces)

### Unit G — App Feed screen
**Owns:** `apps/mobile/app/feed.tsx` (+ `src/components/feed/*`).
**Codes against (frozen):** F's `useEventStream`, `audioQueue.enqueue`, store selectors; feed
UX (`ux-flow.md`, `mobile-app.md`).
**Build:** drama meter (from `score`), card list (narration + drama strip + play), auto-enqueue
audio on `audio` frames, persona control, "Wrap up" button → `api.wrapUp()`.
**Done when:** paired to a live backend, the Feed shows narrated lines appearing with audio,
meter reacting.

### Unit H — App Analytics + wrap-up screens
**Owns:** `apps/mobile/app/analytics.tsx`, `app/devpost.tsx` (+ `components/analytics/*`).
**Codes against (frozen):** F's `api.ts` fetchers + store's `sessionId`; analytics shape
(`api-reference.md`).
**Build:** Analytics screen (mount + 5s poll: cards, `toolCallsByType`, files, risk log),
devpost view rendering the wrap-up result.
**Done when:** Analytics renders real counts from `/session/:id/analytics`; devpost view shows
the draft.

---

## Unit Z — Integration & verify (last, owns only glue)
**Owns:** `.env.example`, root run scripts, README run section — no feature files.
**Build:** wire env vars, start backend + `ngrok http 8787`, generate the pairing QR, run a
real Claude Code session end-to-end to the phone. Confirm the latency budget and the failure
fallbacks (LLM/TTS down). This is where the units meet; it edits nothing they own.
**Done when:** a real agent action shows up as narrated audio on the paired phone, and
Analytics + wrap-up work over the tunnel.

---

## How to run a unit in an isolated session
Give the session: (1) this file's row for the unit (its owned files + "codes against"), (2)
the specific spec doc(s) named in that unit, (3) the instruction "only edit your owned files;
import everything else as already-existing; if a needed interface is missing, it's a Unit 0
gap — report it, don't add it here." That keeps every session's context and file changes
disjoint.

## When the contract must change
If a unit discovers the frozen contract is wrong (a missing field, a bad signature), that is a
**Unit 0 change**, not a local patch. Route it back through Unit 0 and re-freeze, so two units
never diverge on the same interface. Prefer catching these during Unit 0 review.
