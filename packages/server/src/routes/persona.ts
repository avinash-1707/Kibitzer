// STUB — owned by Unit B. Mounts GET/PUT /persona.
import { Hono } from "hono";

export const personaRoutes = new Hono();

personaRoutes.get("/persona", (c) =>
  c.json({ error: "not implemented (Unit B)" }, 501),
);

personaRoutes.put("/persona", (c) =>
  c.json({ error: "not implemented (Unit B)" }, 501),
);
