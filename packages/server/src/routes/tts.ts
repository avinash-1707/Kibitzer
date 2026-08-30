// Owned by Unit A. Mounts GET /api/tts — cache-first audio proxy (architecture.md §7).
import { Hono } from "hono";
import { getRing } from "../store.ts";
import { audioPath, isSafeEventId, synthesize } from "../tts.ts";
import { log } from "../log.ts";

export const ttsRoutes = new Hono();

// GET /api/tts?eventId=… → audio/mpeg. Serves the cached mp3 if present, else
// generates from the event's stored narration and caches. 404 if the event has
// no narration (nothing to speak).
ttsRoutes.get("/api/tts", async (c) => {
  const eventId = c.req.query("eventId");
  // Reject unsafe ids at the boundary before any filesystem touch (path traversal).
  if (!eventId || !isSafeEventId(eventId)) {
    return c.json({ error: "valid eventId required" }, 400);
  }

  let path = audioPath(eventId);
  if (!path) {
    const narration = getRing().find((f) => f.event.id === eventId)?.narration;
    if (!narration) return c.json({ error: "no narration for event" }, 404);
    try {
      path = await synthesize(eventId, narration);
    } catch (err) {
      log.warn(`tts: generation failed for ${eventId}:`, err);
      return c.json({ error: "tts generation failed" }, 502);
    }
  }

  return new Response(Bun.file(path), {
    headers: {
      "Content-Type": "audio/mpeg",
      // Clips are immutable per eventId — let clients cache aggressively on replay.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
