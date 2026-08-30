// STUB — owned by Unit A. Mounts GET /api/tts.
import { Hono } from "hono";

export const ttsRoutes = new Hono();

ttsRoutes.get("/api/tts", (c) =>
  c.json({ error: "not implemented (Unit A)" }, 501),
);
