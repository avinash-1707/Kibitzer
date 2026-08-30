// STUB — owned by Unit A. Signature FROZEN by Unit 0.
import type { KibitzerEvent, PersonaKey } from "@kibitzer/shared";

/**
 * One OpenRouter call producing a one-line narration. On failure Unit A returns
 * templatedFallback(event). See persona-prompts.md for the exact request shape.
 */
export async function narrate(
  _event: KibitzerEvent,
  _recentLines: string[],
  _persona: PersonaKey,
): Promise<string> {
  throw new Error("narrate: not implemented (Unit A)");
}
