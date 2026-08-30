// STUB — owned by Unit C. Mounts POST /session/:id/end and GET /session/:id/devpost.
import { Hono } from "hono";

export const devpostRoutes = new Hono();

devpostRoutes.post("/session/:id/end", (c) =>
  c.json({ error: "not implemented (Unit C)" }, 501),
);

devpostRoutes.get("/session/:id/devpost", (c) =>
  c.json({ error: "not implemented (Unit C)" }, 501),
);
