// STUB — owned by Unit A. Signature FROZEN by Unit 0; Unit A fills the body.
// runPipeline is called fire-and-forget by the ingestion route (never awaited).
import type { KibitzerEvent } from "@kibitzer/shared";

/**
 * Process one event: classify → score → debounce → narrate → tts,
 * broadcasting `score` → `narration` → `audio` frames. See architecture.md §4.
 */
export async function runPipeline(_event: KibitzerEvent): Promise<void> {
  // Unit A: implement. Stub is a no-op so ingestion works before A lands.
  return;
}
