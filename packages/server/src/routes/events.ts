// Owned by Unit B. Mounts POST /events and POST /ingest/claude-code.
import { Hono } from "hono";
import { eventSchema, type KibitzerEvent } from "@kibitzer/shared";
import { saveEvent } from "../store.ts";
import { runPipeline } from "../pipeline.ts";
import { normalizeClaudeCode } from "../normalize/claude-code.ts";

export const eventsRoutes = new Hono();

// Store synchronously, then fire the pipeline WITHOUT awaiting (never block the caller).
// The pipeline is fire-and-forget: a rejection must never crash the process or bubble back
// to the HTTP response (Claude Code hooks fail open — the ingest path must always 2xx).
function ingest(event: KibitzerEvent): void {
  saveEvent(event);
  Promise.resolve(runPipeline(event)).catch((err) =>
    console.error(`pipeline: runPipeline failed for ${event.id}:`, err),
  );
}

// POST /events — one canonical KibitzerEvent (OpenCode / Codex adapters, manual checkpoints).
eventsRoutes.post("/events", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid event", issues: ["malformed JSON body"] }, 400);
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid event", issues: parsed.error.issues }, 400);
  }

  const event = parsed.data as KibitzerEvent;
  ingest(event);
  return c.json({ ok: true, id: event.id }, 202);
});

// POST /ingest/claude-code — raw Claude Code hook payload. Always returns a fast 2xx
// (Claude Code fails open; never make it wait). Unmapped payloads are stored best-effort.
eventsRoutes.post("/ingest/claude-code", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    // Malformed body: nothing to store, but still don't make the hook fail.
    return c.json({ ok: true }, 200);
  }

  // Fail open: the hook must get a fast 2xx even if store/normalize throws.
  try {
    const event = normalizeClaudeCode(raw) ?? bestEffortEvent(raw);
    if (event) ingest(event);
  } catch (err) {
    console.error("ingest/claude-code: dropped payload:", err);
  }
  return c.json({ ok: true }, 200);
});

// Store a payload the normalizer couldn't map, so schema drift never breaks the session.
// Keeps `raw` for debugging and a best-effort type derived from any session id present.
function bestEffortEvent(raw: unknown): KibitzerEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const sessionId = (raw as { session_id?: unknown }).session_id;
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;
  return {
    id: crypto.randomUUID(),
    sessionId,
    source: "claude-code",
    type: "checkpoint",
    timestamp: new Date().toISOString(),
    detail: { raw },
  };
}
