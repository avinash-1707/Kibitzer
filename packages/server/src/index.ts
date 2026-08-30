// Server entry — Bun.serve + Hono. Owned by Unit 0: mounts every route module up front so
// downstream units only fill their own route files. Do not add feature logic here.
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { log } from "./log.ts";
import { eventsRoutes } from "./routes/events.ts";
import { streamRoutes } from "./routes/stream.ts";
import { analyticsRoutes } from "./routes/analytics.ts";
import { ttsRoutes } from "./routes/tts.ts";
import { devpostRoutes } from "./routes/devpost.ts";
import { personaRoutes } from "./routes/persona.ts";

const app = new Hono();

// Request logging FIRST so it wraps everything below. Hono's logger prints two lines
// per request: `<-- METHOD /path` on entry and `--> METHOD /path status durationMs` on
// exit. For the SSE stream (/events/stream) the exit line only fires on disconnect, so
// it doubles as a connect/disconnect + duration trace for long-lived streams. Routed
// through our leveled `log` so it shares timestamps/format with handler logs and can be
// muted via LOG_LEVEL.
app.use("*", logger((message, ...rest) => log.info(message, ...rest)));

// The mobile app on-device is same-origin (<base>), so it needs no CORS. But when the
// app runs as Expo web, or the dashboard is served cross-origin, the browser enforces
// CORS (api-reference.md §CORS). Single-session demo tool → allow any origin.
app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true }));

// Each module owns its own paths; mounted at root so paths are absolute as documented.
app.route("/", eventsRoutes);
app.route("/", streamRoutes);
app.route("/", analyticsRoutes);
app.route("/", ttsRoutes);
app.route("/", devpostRoutes);
app.route("/", personaRoutes);

const port = Number(process.env.KIBITZER_PORT ?? 8787);

export default {
  port,
  fetch: app.fetch,
  // SSE (/events/stream) holds connections open indefinitely, pushing frames as
  // events arrive with only a 15s heartbeat. Bun's default idleTimeout is 10s, so
  // it would close the stream 5s before the first heartbeat — the client would
  // reconnect every ~10s. 0 disables the per-request idle timeout.
  idleTimeout: 0,
};

log.info(`Kibitzer server listening on http://localhost:${port}`);
