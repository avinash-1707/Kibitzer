// Owned by Unit A. Accumulates events per session into a "turn" and decides WHEN to narrate.
// We narrate once per turn, never per command. A turn flushes when:
//   - the agent finishes its response  (turn_complete / session_end), OR
//   - it has piled up enough actions    (size fallback for sources with no turn boundary), OR
//   - it's gone idle                    (time fallback so a stalled turn still narrates).
import type { KibitzerEvent } from "@kibitzer/shared";

// Fallbacks for sources (OpenCode/Codex) that may never emit a turn boundary.
const SIZE_FLUSH_ACTIONS = 12; // flush after this many meaningful actions with no turn end
const IDLE_FLUSH_MS = 20_000; // ...or after this long with no new event (re-armed each feed)
const MAX_BUFFERED_EVENTS = 200; // hard cap so a Read-storm can't bloat the prompt/memory
// A turn boundary right after a size-flush, carrying no new work, is the tail of the turn we
// already narrated — don't narrate "…and it's done" over nothing.
const EMPTY_BOUNDARY_WINDOW_MS = 5_000;

interface Buffer {
  events: KibitzerEvent[];
  scores: number[];
  meaningful: number;
  timer: ReturnType<typeof setTimeout> | null;
  lastFlushAt: number; // 0 until this session has flushed at least once
}

const buffers = new Map<string, Buffer>();

function isMeaningful(e: KibitzerEvent): boolean {
  if (e.type === "tool_call" && e.detail.tool === "Read") return false;
  return e.type === "tool_call" || e.type === "file_edit";
}

// A turn boundary the source told us about explicitly.
function isTurnBoundary(e: KibitzerEvent): boolean {
  return e.type === "turn_complete" || e.type === "session_end";
}

export interface FlushResult {
  events: KibitzerEvent[]; // the whole turn, oldest→newest
  scores: number[]; // drama scores aligned with events
  anchorId: string; // event id the narration/audio attaches to (the last event)
}

/**
 * Feed one scored event into its session's turn buffer. Returns a FlushResult when the turn
 * is ready to narrate, or null while it's still accumulating. When an idle-based flush fires
 * from the timer, `onTimeFlush` is invoked with the result (there's no event to return it on).
 */
export function feed(
  event: KibitzerEvent,
  score: number,
  onTimeFlush: (result: FlushResult) => void,
): FlushResult | null {
  const sessionId = event.sessionId;

  // session_start is its own tiny beat — never batched. Drop any stale buffer/timer left over
  // from a prior run reusing this id, so it can't fire later and invert ordering.
  if (event.type === "session_start") {
    drain(sessionId);
    return { events: [event], scores: [score], anchorId: event.id };
  }

  const buf = buffers.get(sessionId) ?? {
    events: [],
    scores: [],
    meaningful: 0,
    timer: null,
    lastFlushAt: 0,
  };
  const lastFlushAt = buf.lastFlushAt;
  buffers.set(sessionId, buf);

  // A boundary arriving right after a size-flush, with no new work, is that turn's tail —
  // clear it and stay silent rather than narrating an empty beat.
  if (
    isTurnBoundary(event) &&
    buf.meaningful === 0 &&
    lastFlushAt > 0 &&
    Date.now() - lastFlushAt < EMPTY_BOUNDARY_WINDOW_MS
  ) {
    // Keep this event as context for the NEXT turn rather than dropping it entirely.
    buf.events.push(event);
    buf.scores.push(score);
    return null;
  }

  buf.events.push(event);
  buf.scores.push(score);
  if (isMeaningful(event)) buf.meaningful++;

  // (Re)arm the idle fallback on every event, so it fires only after a real lull — not as a
  // fixed deadline that would split a long-but-active turn.
  if (buf.timer) clearTimeout(buf.timer);
  buf.timer = setTimeout(() => {
    const result = drain(sessionId);
    if (result) onTimeFlush(result);
  }, IDLE_FLUSH_MS);
  buf.timer.unref?.();

  if (
    isTurnBoundary(event) ||
    buf.meaningful >= SIZE_FLUSH_ACTIONS ||
    buf.events.length >= MAX_BUFFERED_EVENTS
  ) {
    return drain(sessionId);
  }
  return null;
}

// Pull the buffered turn out, clearing its timer and state. Null if nothing was buffered.
// Remembers when this session last flushed so the next turn can suppress an empty tail.
function drain(sessionId: string): FlushResult | null {
  const buf = buffers.get(sessionId);
  if (!buf) return null;
  if (buf.timer) clearTimeout(buf.timer);
  if (buf.events.length === 0) {
    buffers.delete(sessionId);
    return null;
  }
  const anchorId = buf.events[buf.events.length - 1]!.id;
  const result = { events: buf.events, scores: buf.scores, anchorId };
  // Reset the session in place, preserving the flush timestamp for empty-tail suppression.
  buffers.set(sessionId, {
    events: [],
    scores: [],
    meaningful: 0,
    timer: null,
    lastFlushAt: Date.now(),
  });
  return result;
}

// Test seam: drop all buffered state (and timers) so tests don't leak across cases.
export function _resetTurnBuffers(): void {
  for (const buf of buffers.values()) if (buf.timer) clearTimeout(buf.timer);
  buffers.clear();
}
