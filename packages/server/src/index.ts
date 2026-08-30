// Server entry — Bun.serve + Hono. Owned by Unit 0: mounts every route module up front so
// downstream units only fill their own route files. Do not add feature logic here.
import { Hono } from "hono";
import { cors } from "hono/cors";
import { eventsRoutes } from "./routes/events.ts";
import { streamRoutes } from "./routes/stream.ts";
import { analyticsRoutes } from "./routes/analytics.ts";
import { ttsRoutes } from "./routes/tts.ts";
import { devpostRoutes } from "./routes/devpost.ts";
import { personaRoutes } from "./routes/persona.ts";

const app = new Hono();

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
};

console.log(`Kibitzer server listening on http://localhost:${port}`);
