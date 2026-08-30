// Owned by Unit C. Mounts POST /session/:id/end and GET /session/:id/devpost.
// The devpost is generated on an explicit wrap-up (never auto-fired — architecture.md §8),
// cached on the sessions row, and served from cache thereafter. A re-POST regenerates.
import { Hono } from "hono";
import type { Devpost } from "@kibitzer/shared";
import { rawDb } from "../store.ts";
import { generateDevpost, NoEventsError } from "../devpost.ts";

export const devpostRoutes = new Hono();

// Seed startedAt from the session's earliest event so a wrap-up never creates a row with a
// NULL startedAt (which would break analytics' durationMs). Only endedAt/devpost are updated
// on conflict, so an existing startedAt is preserved.
const cacheDevpost = rawDb.query<
  unknown,
  { $id: string; $devpost: string; $endedAt: string }
>(
  `INSERT INTO sessions (id, startedAt, endedAt, devpost)
     VALUES ($id, (SELECT MIN(timestamp) FROM events WHERE sessionId = $id), $endedAt, $devpost)
     ON CONFLICT(id) DO UPDATE SET endedAt = $endedAt, devpost = $devpost`,
);
const selectDevpost = rawDb.query<{ devpost: string | null }, { $id: string }>(
  `SELECT devpost FROM sessions WHERE id = $id`,
);

// Explicit trigger (dashboard "Wrap up session"). Regenerates over the full transcript,
// caches, and returns { post, tweetThread }.
devpostRoutes.post("/session/:id/end", async (c) => {
  const sessionId = c.req.param("id");
  let devpost: Devpost;
  try {
    devpost = await generateDevpost(sessionId);
  } catch (err) {
    // No events → the session doesn't exist for our purposes (404). Any other failure is an
    // upstream/LLM problem (502) — don't leak provider internals into the response body.
    if (err instanceof NoEventsError) return c.json({ error: err.message }, 404);
    console.error(`devpost generation failed for ${sessionId}:`, err);
    return c.json({ error: "devpost generation failed" }, 502);
  }

  cacheDevpost.run({
    $id: sessionId,
    $endedAt: new Date().toISOString(),
    $devpost: JSON.stringify(devpost),
  });
  return c.json(devpost);
});

// Returns the cached devpost, or 404 if this session hasn't been wrapped up yet.
devpostRoutes.get("/session/:id/devpost", (c) => {
  const sessionId = c.req.param("id");
  const row = selectDevpost.get({ $id: sessionId });
  if (!row?.devpost) return c.json({ error: "not generated yet" }, 404);
  return c.json(JSON.parse(row.devpost) as Devpost);
});
