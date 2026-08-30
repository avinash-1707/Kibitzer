// STUB — owned by Unit C. Mounts GET /session/:id/analytics.
import { Hono } from "hono";

export const analyticsRoutes = new Hono();

analyticsRoutes.get("/session/:id/analytics", (c) =>
  c.json({ error: "not implemented (Unit C)" }, 501),
);
