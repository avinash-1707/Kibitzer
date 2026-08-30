# Kibitzer — Project Overview

## One-liner
Live voice commentary and analytics for AI coding agent sessions (Claude Code, OpenCode, Codex).

## Problem
Agentic dev sessions are a black box. An AI agent runs dozens of tool calls, edits files,
runs commands, backtracks, and self-corrects, but the only visibility a developer (or an
onlooker) has is a scrolling terminal. There's no ambient sense of "how is this session
going," no lightweight audit trail of what an agent actually did and why, and no easy way
to turn a build session into something shareable.

## Solution
Kibitzer sits between whichever AI coding CLI a developer is using and the developer
themselves. It listens to the agent's native event system (hooks, plugins, or notify
callbacks — different per tool), and turns the raw event stream into two things at once:

1. **Live commentary** — a persona (sports commentator, nature documentarian)
   narrates the session in real time, spoken aloud via text-to-speech, with a "drama meter"
   that spikes on risky or dramatic moments (destructive commands, test failures, repeated
   backtracks on the same file).
2. **Real observability** — the same event stream, rendered as plain analytics: tool-call
   breakdown, files touched, test pass/fail counts, time-to-first-commit, backtrack count.

The **mobile app is the main way you watch the show** — a stories-style live feed with the
narration playing on-device, plus an analytics view that turns the same stream into a real
audit log in your pocket. When the builder wraps up the session, Kibitzer also drafts a
devpost/tweet-thread summary from the actual transcript.

## Target users
- **Primary (hackathon demo):** developers using Claude Code, OpenCode, or Codex CLI who
  want their build session to be watchable and shareable.
- **Secondary (real use case beyond the hackathon):** any team running agentic coding
  workflows who currently has zero visibility into what an autonomous agent did during a
  session — Kibitzer's analytics view is a genuine audit log.

## Key differentiators
- **Agent-agnostic by design.** Claude Code, OpenCode, and Codex each expose a completely
  different extension mechanism (native HTTP hooks, TypeScript plugins under Bun, a
  turn-level `notify` callback). Kibitzer normalizes all three into one event schema (see
  `event-schema.md` for the verified per-tool mappings). This is the hardest and most
  defensible part of the build — most tools in this space are single-vendor.
- **Entertainment and utility from one data source.** The same events power both the fun
  commentary and the serious analytics tab — no duplicated pipeline.
- **Mobile-native delivery, not a wrapped dashboard.** A stories-style feed with on-device
  audio narration in your pocket is the actual product — a phone you glance at while the agent
  works, not a browser tab you babysit. That's the honest answer to "why an app."
- **The demo narrates itself.** Point Kibitzer at the session used to build Kibitzer, and
  the pitch is the product working live.

## Primary interface: the mobile app
**Kibitzer is a mobile-first product.** The phone is the main way you watch a session — a
native live feed, on-device audio narration, and an analytics/audit view in your pocket. The
web dashboard is a secondary, big-screen view (useful at a desk or for judges), not the
headline. See `mobile-app.md` for the app spec and `ux-flow.md` for screen flows.

## Scope for the hackathon (must-have) — ~3-hour build
- Claude Code adapter (native HTTP hooks) — richest signal, most attendees use this tool.
- Normalized event schema + Bun/Hono ingestion server.
- Persona narration (1 persona to start) via an LLM, played back via TTS.
- **Mobile app (Expo, installed on-device)** — the primary interface:
  - **Pairing** — scan a QR to connect the phone to the running backend over an **ngrok**
    tunnel (Cloudflare quick tunnels can't carry SSE), so it works on any Wi-Fi.
  - **Live feed** — real-time narrated timeline via SSE (`react-native-sse`), with a drama
    meter.
  - **On-device audio** — plays the ElevenLabs TTS clips, queued so lines don't overlap.
  - **Analytics** — the audit-log view (tool-call breakdown, files touched, test pass/fail,
    backtracks, risk log) rendered natively.
- Devpost/tweet draft generated from the transcript on an explicit "Wrap up session".

> **Push notifications are cut** for this build — remote push needs an Expo dev build with
> FCM/APNs credentials (lead time we don't have in 3 hours). The app runs installed on-device
> and pulls the live feed over the tunnel instead; a drama spike animates in-feed rather than
> firing an OS notification.

## Secondary (build only after the app works)
- Web dashboard (Commentary + Analytics) — same backend, big-screen view for judges.
- OpenCode adapter (plugin-based, similarly rich to Claude Code) — proves agent-agnostic.
- Codex adapter (legacy `notify` hook — turn-level only).
- A second persona.

## Explicitly out of scope
- Any feature that *controls* or steers the agent (that's Anthropic's / each vendor's
  remote-control surface, not this tool's job — Kibitzer only observes).
- Multi-user / team accounts, auth, or hosting beyond localhost for the demo.
- Durable orchestration, message queues, or anything from the "production infra" toolbox —
  a single Bun process is enough for a one-day build.

## Success criteria for demo day
- The **phone** is running against the live session that built Kibitzer, narrating in real
  time — feed scrolling, audio playing on-device, drama meter reacting.
- A judge can pick up the phone, tap Analytics, ask "what actually happened in this session,"
  and get a real answer — not just a joke from the feed.
- Pairing works on the venue Wi-Fi (via the tunnel), so the app is live on-device, not a
  simulator.
