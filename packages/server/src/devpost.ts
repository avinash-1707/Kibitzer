// Owned by Unit C. Signature FROZEN by Unit 0.
// One-shot LLM summary over a session's full transcript (read from SQLite). See
// architecture.md §8 — this is the ONLY call that gets the whole log; per-event narration
// never does. Callers (routes/devpost.ts) cache the result on the sessions row.
import { describeEvent } from "@kibitzer/shared";
import type { Devpost, KibitzerEvent, KibitzerEventDetail } from "@kibitzer/shared";
import { rawDb } from "./store.ts";

// Prompt lives in a version-controlled file, not an inline throwaway string (project rule).
const DEVPOST_SYSTEM =
  `You are a technical writer producing a hackathon project devpost from a coding session log.
Write in an engaging, honest voice — celebrate real progress, don't invent features.
Return ONLY valid JSON of the form {"post": string, "tweetThread": string[]} where:
- "post" is a 2-4 paragraph markdown devpost describing what was built, the notable moments
  (test failures fought through, risky commands, backtracks), and the outcome.
- "tweetThread" is 3-5 short tweets (each under 280 chars) narrating the build as a story.
No prose outside the JSON.`;

interface TranscriptRow {
  id: string;
  sessionId: string;
  source: string;
  type: string;
  timestamp: string;
  detail: string;
}

const selectTranscript = rawDb.query<TranscriptRow, { $id: string }>(
  `SELECT id, sessionId, source, type, timestamp, detail
     FROM events WHERE sessionId = $id ORDER BY timestamp`,
);

/** Thrown when a session has no events to summarise — the caller maps this to a 404. */
export class NoEventsError extends Error {}

/** Render the stored events into a compact, human-readable transcript for the LLM. */
function buildTranscript(rows: TranscriptRow[]): string {
  return rows
    .map((r) => {
      const event: KibitzerEvent = {
        id: r.id,
        sessionId: r.sessionId,
        source: r.source as KibitzerEvent["source"],
        type: r.type as KibitzerEvent["type"],
        timestamp: r.timestamp,
        detail: JSON.parse(r.detail) as KibitzerEventDetail,
      };
      return `- ${describeEvent(event)}`;
    })
    .join("\n");
}

function coerceDevpost(raw: unknown): Devpost {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const post = typeof o.post === "string" ? o.post : "";
    const tweetThread = Array.isArray(o.tweetThread)
      ? o.tweetThread.filter((t): t is string => typeof t === "string")
      : [];
    if (post) return { post, tweetThread };
  }
  throw new Error("devpost: model returned an unusable shape");
}

/**
 * One-shot LLM summary over a session's full transcript (read from SQLite).
 * Throws if the session has no events or the LLM is unreachable — the caller decides how to
 * surface that (this is an explicit, user-triggered wrap-up, not the never-block feed path).
 */
export async function generateDevpost(sessionId: string): Promise<Devpost> {
  const rows = selectTranscript.all({ $id: sessionId });
  if (rows.length === 0) throw new NoEventsError(`no events for session ${sessionId}`);

  const transcript = buildTranscript(rows);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://kibitzer.local",
      "X-Title": "Kibitzer",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_DEVPOST_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: DEVPOST_SYSTEM },
        { role: "user", content: `Session transcript (oldest first):\n${transcript}` },
      ],
    }),
    signal: AbortSignal.timeout(60_000), // don't pin the handler on a hung provider
  });
  if (!res.ok) {
    throw new Error(`devpost: OpenRouter ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("devpost: empty LLM response");

  return coerceDevpost(JSON.parse(content));
}
