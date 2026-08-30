// STUB — owned by Unit B. Mounts POST /events and POST /ingest/claude-code.
import { Hono } from "hono";

export const eventsRoutes = new Hono();

eventsRoutes.post("/events", (c) =>
  c.json({ error: "not implemented (Unit B)" }, 501),
);

eventsRoutes.post("/ingest/claude-code", (c) =>
  c.json({ error: "not implemented (Unit B)" }, 501),
);
