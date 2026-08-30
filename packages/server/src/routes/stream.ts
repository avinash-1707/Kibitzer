// STUB — owned by Unit B. Mounts GET /events/stream (SSE).
import { Hono } from "hono";

export const streamRoutes = new Hono();

streamRoutes.get("/events/stream", (c) =>
  c.json({ error: "not implemented (Unit B)" }, 501),
);
