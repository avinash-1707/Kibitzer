// STUB — owned by Unit A. Signatures FROZEN by Unit 0.
// ElevenLabs Flash v2.5 → mp3 at packages/server/public/audio/<eventId>.mp3, cache-first.

/** Generate (if needed) and return the on-disk path for an event's narration audio. */
export async function synthesize(_eventId: string, _text: string): Promise<string> {
  throw new Error("synthesize: not implemented (Unit A)");
}

/** Absolute path to a cached clip, or null if not yet generated. */
export function audioPath(_eventId: string): string | null {
  return null;
}
