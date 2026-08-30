// Owned by Unit A. Narrates a whole TURN (one user prompt's worth of agent work), not a
// single command. Length is chosen by the caller from the turn's action size and passed in.
import type { LengthSpec, PersonaKey } from "@kibitzer/shared";
import { PERSONAS } from "./personas.ts";

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

/**
 * One OpenRouter call producing the narration for a turn. `summary` is the compact,
 * pre-built recap of what the agent did (see summarizeTurn); `spec` sets the target length.
 * On any failure (network, non-2xx, malformed body) returns the fallback so the feed never
 * breaks. See persona-prompts.md for the request shape.
 */
export async function narrate(
  summary: string,
  recentLines: string[],
  persona: PersonaKey,
  spec: LengthSpec,
  fallback: string,
): Promise<string> {
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
        max_tokens: spec.maxTokens,
        temperature: 0.7,
        messages: [
          { role: "system", content: PERSONAS[persona].system },
          {
            role: "user",
            content:
              (recentLines.length
                ? `Earlier this session (don't repeat these):\n${recentLines.join("\n")}\n\n`
                : "") +
              `Length: ${spec.guidance}\n\n` +
              `Here's what the agent just did for one request:\n${summary}`,
          },
        ],
      }),
    });
    if (!res.ok) return fallback; // never break the feed
    const data = (await res.json()) as ChatCompletion;
    const line = data.choices?.[0]?.message?.content?.trim();
    return line && line.length > 0 ? line : fallback;
  } catch {
    return fallback; // network error, bad JSON — fall back
  }
}
