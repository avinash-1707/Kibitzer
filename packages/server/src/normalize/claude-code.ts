// STUB — owned by Unit B. Signature FROZEN by Unit 0.
// Maps a raw Claude Code hook payload → canonical KibitzerEvent (see event-schema.md).
import type { KibitzerEvent } from "@kibitzer/shared";

/**
 * Normalize a raw Claude Code hook body into a canonical event.
 * Returns null if the payload can't be mapped (caller stores it best-effort).
 */
export function normalizeClaudeCode(_raw: unknown): KibitzerEvent | null {
  return null;
}
