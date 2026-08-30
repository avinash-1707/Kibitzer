// Owned by Unit A. Signature FROZEN by Unit 0.
// runPipeline is called fire-and-forget by the ingestion route (never awaited).
import {
  dramaScore,
  isDestructive,
  lengthFor,
  summarizeTurn,
  templatedFallback,
  turnShape,
  type FeedItem,
  type KibitzerEvent,
} from "@kibitzer/shared";
import { broadcast } from "./bus.ts";
import { narrate } from "./narrate.ts";
import {
  getPersona,
  pushFeedItem,
  recentBefore,
  updateEvent,
} from "./store.ts";
import { synthesize } from "./tts.ts";
import { feed, type FlushResult } from "./turnBuffer.ts";
import { log } from "./log.ts";

/**
 * Process one event: classify → score → broadcast the `score` frame, then hand it to the
 * turn buffer. Narration is NOT per command — it fires once per turn (one user prompt's
 * worth of work) when the buffer flushes, and its length scales with how much the agent did.
 * See architecture.md §4.
 */
export async function runPipeline(event: KibitzerEvent): Promise<void> {
  // 0. Classify — the server is the sole source of truth for isDestructive.
  event.detail.isDestructive = isDestructive(event.detail);

  // 1. Drama score — computed over PRIOR items only (recentBefore excludes self),
  //    then push the FeedItem so subsequent events see this one as context.
  const prior = recentBefore(event.id);
  const recent = prior.map((f) => f.event);
  const scores = prior.map((f) => f.dramaScore ?? 0);
  const score = dramaScore(event, recent, scores);

  const item: FeedItem = {
    event,
    dramaScore: score,
    narration: null,
    audioUrl: null,
  };
  pushFeedItem(item);
  updateEvent(event.id, { dramaScore: score, detail: event.detail });
  broadcast("score", { eventId: event.id, dramaScore: score });

  // 2. Buffer into the current turn. A flush means the turn is ready to narrate; otherwise
  //    the event is stored + scored only, and we stay silent until the turn closes.
  const flush = feed(event, score, (result) =>
    enqueueTurn(result.events[0]!.sessionId, result),
  );
  if (flush) await enqueueTurn(event.sessionId, flush);
}

// Serialize narration per session so back-to-back flushes (a size-flush then a turn_complete,
// or an idle-flush racing a boundary) never overlap: turn N's narration must land before turn
// N+1 reads recentBefore() for its anti-repetition context, and its audio must not interleave.
const chain = new Map<string, Promise<unknown>>();

function enqueueTurn(sessionId: string, turn: FlushResult): Promise<unknown> {
  const run = () => narrateTurn(turn);
  const next = (chain.get(sessionId) ?? Promise.resolve())
    .then(run, run) // run regardless of whether the prior turn resolved or rejected
    .catch((err) => log.warn(`pipeline: narrateTurn failed:`, err));
  chain.set(sessionId, next);
  void next.finally(() => {
    if (chain.get(sessionId) === next) chain.delete(sessionId);
  });
  return next;
}

/**
 * Narrate one whole turn: pick a length from the turn's action size, summarize what the
 * agent did, run one LLM call, then eager-generate the audio. Narration + audio attach to
 * the turn's anchor (its last event), whose FeedItem is already in the ring.
 */
async function narrateTurn(turn: FlushResult): Promise<void> {
  const shape = turnShape(turn.events, turn.scores);
  const spec = lengthFor(shape);
  const summary = summarizeTurn(turn.events);

  const anchor = turn.events[turn.events.length - 1]!;
  const fallback = templatedFallback(anchor);

  // 3. Narration — one LLM call; falls back internally, so this never throws.
  const recentLines = recentBefore(turn.anchorId)
    .map((f) => f.narration)
    .filter((n): n is string => n !== null)
    .slice(-3);
  const narration = await narrate(
    summary,
    recentLines,
    getPersona(),
    spec,
    fallback,
  );
  updateEvent(turn.anchorId, { narration });

  // Snapshot for the frame; step 4 mutates the stored item afterward. Use the turn's drama
  // PEAK, not the anchor's score — the anchor is usually turn_complete, which scores ~0.
  broadcast("narration", {
    event: anchor,
    dramaScore: shape.dramaPeak,
    narration,
    audioUrl: null,
  });

  // 4. TTS — eager pre-generate. On failure log and skip: audio is additive, the narration
  //    text already landed, so the feed is never blocked or broken.
  try {
    await synthesize(turn.anchorId, narration);
    const audioUrl = `/api/tts?eventId=${turn.anchorId}`;
    updateEvent(turn.anchorId, { audioUrl });
    broadcast("audio", { eventId: turn.anchorId, audioUrl });
  } catch (err) {
    log.warn(`pipeline: tts failed for ${turn.anchorId}:`, err);
  }
}
