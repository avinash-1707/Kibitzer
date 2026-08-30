// Owned by Unit A. Signature FROZEN by Unit 0.
import {
  describeEvent,
  templatedFallback,
  type KibitzerEvent,
  type PersonaKey,
} from "@kibitzer/shared";
import { PERSONAS } from "./personas.ts";

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

/**
 * One OpenRouter call producing a one-line narration. On any failure (network,
 * non-2xx, or a malformed body) returns templatedFallback(event) so the feed
 * never breaks. See persona-prompts.md for the frozen request shape.
 */
export async function narrate(
  event: KibitzerEvent,
  recentLines: string[],
  persona: PersonaKey,
): Promise<string> {
  const eventSummary = describeEvent(event); // e.g. "Bash `npm test` → FAILURE"
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kibitzer.local",
        "X-Title": "Kibitzer",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_NARRATION_MODEL,
        max_tokens: 60,
        temperature: 0.8,
        messages: [
          { role: "system", content: PERSONAS[persona].system },
          {
            role: "user",
            content:
              (recentLines.length
                ? `Recent lines (do not repeat these):\n${recentLines.join("\n")}\n\n`
                : "") + `Narrate this event: ${eventSummary}`,
          },
        ],
      }),
    });
    if (!res.ok) return templatedFallback(event); // never break the feed
    const data = (await res.json()) as ChatCompletion;
    const line = data.choices?.[0]?.message?.content?.trim();
    return line && line.length > 0 ? line : templatedFallback(event);
  } catch {
    return templatedFallback(event); // network error, bad JSON — fall back
  }
}
