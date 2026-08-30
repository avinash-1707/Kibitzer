// STUB — owned by Unit C. Signature FROZEN by Unit 0.
import type { Devpost } from "@kibitzer/shared";

/**
 * One-shot LLM summary over a session's full transcript (read from SQLite).
 * Cached on the sessions row; re-invocation regenerates. See architecture.md §8.
 */
export async function generateDevpost(_sessionId: string): Promise<Devpost> {
  throw new Error("generateDevpost: not implemented (Unit C)");
}
