// Owned by Unit A. Signature FROZEN by Unit 0.
// runPipeline is called fire-and-forget by the ingestion route (never awaited).
import {
  dramaScore,
  isDestructive,
  shouldNarrate,
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
import { log } from "./log.ts";

/**
 * Process one event: classify → score → debounce → narrate → tts,
 * broadcasting `score` → `narration` → `audio` frames as each stage resolves so
 * the feed never waits on the slowest stage. See architecture.md §4.
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

  // 2. Debounce/filter — drop Read spam and duplicate bursts (stored + scored only).
  if (!shouldNarrate(event, recent)) return;

  // 3. Narration — one LLM call; falls back internally, so this never throws.
  const recentLines = prior
    .map((f) => f.narration)
    .filter((n): n is string => n !== null)
    .slice(-3);
  const narration = await narrate(event, recentLines, getPersona());
  item.narration = narration;
  updateEvent(event.id, { narration });
  // Snapshot: the frame carries audioUrl:null now; step 4 mutates `item` afterward.
  broadcast("narration", { ...item });

  // 4. TTS — eager pre-generate. On failure log and skip: audio is additive, the
  //    narration text already landed, so the feed is never blocked or broken.
  try {
    await synthesize(event.id, narration);
    const audioUrl = `/api/tts?eventId=${event.id}`;
    item.audioUrl = audioUrl;
    updateEvent(event.id, { audioUrl });
    broadcast("audio", { eventId: event.id, audioUrl });
  } catch (err) {
    log.warn(`pipeline: tts failed for ${event.id}:`, err);
  }
}
