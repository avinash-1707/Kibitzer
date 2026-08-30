# Kibitzer — Persona Prompts & Drama Meter

Prompts live in version-controlled files (`packages/server/src/personas.ts`), never inline
strings — per project rule. Narration lines are one or two sentences, spoken aloud.

## Persona system prompts

```ts
// packages/server/src/personas.ts
export const PERSONAS = {
  sports: {
    label: "Sports commentator",
    system:
`You are a live sports commentator narrating a software engineer's AI coding agent as it
works, as if it were a match. React to each event with energy and specific detail from the
event — never generic hype. One or two sentences, spoken aloud. Reference the previous lines
only to build a throughline (a comeback, a losing streak, a clutch save) — never repeat a
joke you've already made this session.`,
  },
  nature: {
    label: "Nature documentarian",
    system:
`You are a nature documentary narrator (calm, observational, faintly amused) describing the
behavior of a coding agent as if it were a wild animal being studied. Dry, deadpan tone. One
or two sentences. Build on prior observations rather than repeating them — track recurring
"behaviors" (e.g. repeatedly retrying the same file) as a running motif.`,
  },
} as const;

export type PersonaKey = keyof typeof PERSONAS;
```

> The Analytics "risk log" uses `describeEvent()` (a pure formatter in `shared/describe.ts`),
> **not** an LLM call — so there's no separate risk-log system prompt. See `api-reference.md`.

## Narration LLM call — exact shape

One OpenRouter call per narrated event. Verified request shape (see `architecture.md` for
model choice and env vars).

```ts
// packages/server/src/narrate.ts
export async function narrate(
  event: KibitzerEvent,
  recentLines: string[],          // last 2–3 narration strings, oldest→newest
  persona: PersonaKey,
): Promise<string> {
  const eventSummary = describeEvent(event); // e.g. "Bash `npm test` → FAILURE"
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://kibitzer.local",
      "X-Title": "Kibitzer",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_NARRATION_MODEL, // meta-llama/llama-3.1-8b-instruct
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
  const data = await res.json();
  return data.choices[0].message.content.trim();
}
```

### Event summary + fallback helpers

Both live in `packages/shared/src/describe.ts` so the pipeline and the analytics risk log
share one formatter (no separate LLM call for the risk log — see `api-reference.md`).

```ts
// packages/shared/src/describe.ts
export function describeEvent(e: KibitzerEvent): string {
  const d = e.detail;
  const outcome = d.outcome && d.outcome !== "unknown" ? ` → ${d.outcome.toUpperCase()}` : "";
  if (e.type === "tool_call" && d.tool === "Bash") return `Bash \`${d.command ?? ""}\`${outcome}`;
  if (e.type === "tool_call") return `${d.tool} ${d.filePath ?? ""}${outcome}`.trim();
  if (e.type === "file_edit") return `Edited ${d.filePath ?? "a file"}`;
  if (e.type === "turn_complete") return `Turn complete${outcome}`;
  if (e.type === "session_start") return "Session started";
  if (e.type === "session_end") return "Session ended";
  return e.type;
}

// Templated narration when the LLM is unreachable — never break the feed.
export function templatedFallback(e: KibitzerEvent): string {
  return describeEvent(e).replace(/`/g, "");
}
```

`describeEvent` output doubles as the Analytics `riskLog[].logLine` — one formatter, no LLM
call on analytics fetch.

## Drama meter — pure function

`dramaScore` is a pure function so it's instant, free, and unit-testable. It never calls an
LLM.

> **Convention:** `recent` and `scores` are the events/scores that came **before** this one
> (they do NOT include the current event). The pipeline computes the score *before* pushing
> the event into the ring, so this holds naturally. `recent[i]` and `scores[i]` are aligned.

```ts
// packages/shared/src/drama.ts
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// How many times this file was edited in `recent` (prior events only). Handles undefined.
function editCountForFile(filePath: string | undefined, recent: KibitzerEvent[]): number {
  if (!filePath) return 0;
  return recent.filter(
    (r) => (r.type === "tool_call" || r.type === "file_edit") && r.detail.filePath === filePath,
  ).length;
}

export function dramaScore(
  event: KibitzerEvent,
  recent: KibitzerEvent[],        // PRIOR events oldest→newest, for context modifiers
  scores: number[],               // PRIOR scores oldest→newest, aligned with `recent`
): number {
  const base = baseScore(event, recent);
  let score = base;
  // Modifiers only apply to events interesting enough to be narrated (skip Read/dupe noise).
  if (base > 2) {
    const last = scores.at(-1);
    if (last !== undefined && last >= 50) score += 15;             // compounding drama
    if (scores.length >= 3 && scores.slice(-3).every((s) => s < 15)) score -= 10; // cool down
  }
  return clamp(score, 0, 100);
}

function baseScore(e: KibitzerEvent, recent: KibitzerEvent[]): number {
  const d = e.detail;
  if (d.isDestructive) return 90;
  if (e.type === "tool_call" && d.tool === "Read") return 2;
  if (e.type === "tool_call" && (d.tool === "Edit" || d.tool === "Write")) {
    // +1 because this edit is the (count+1)th; 3rd+ edit of the same file = backtrack.
    return editCountForFile(d.filePath, recent) + 1 >= 3 ? 45 : 10;
  }
  if (e.type === "tool_call" && d.tool === "Bash") return d.outcome === "failure" ? 55 : 15;
  if (e.type === "turn_complete") return d.outcome === "failure" ? 55 : 5;
  if (e.type === "session_end") return 20;                        // small closing beat
  if (e.type === "file_edit") return 10;
  return 5;
}
```

**Base scores:**
| Condition | Base |
|---|---|
| Routine `Read` | 2 |
| `Edit`/`Write`, first times on a file | 10 |
| Same file edited 3+ times (backtrack) | 45 |
| `Bash` success | 15 |
| `Bash` fail / test failure | 55 |
| `isDestructive: true` | 90 |
| `turn_complete`, no error | 5 |
| `session_end` | 20 |

**Modifiers:** `+15` if the previous event scored ≥50 (compounding); `−10` if the last 3
events were all <15 (visible cool-down so the meter doesn't idle hot).

## Debounce predicate — pure function

`recent` here is also PRIOR events only (same convention as `dramaScore`), so the event is
never compared against itself.

```ts
// packages/shared/src/drama.ts (or a sibling)
export function shouldNarrate(e: KibitzerEvent, recent: KibitzerEvent[]): boolean {
  if (e.type === "tool_call" && e.detail.tool === "Read") return false;
  const twoSecAgo = Date.parse(e.timestamp) - 2000;
  const dupe = recent.some(
    (r) =>
      r.id !== e.id &&                          // defensive: never match self
      r.type === e.type &&
      r.detail.tool === e.detail.tool &&
      Date.parse(r.timestamp) >= twoSecAgo,
  );
  return !dupe;
}
```

**Unit test targets (smallest thing that fails if broken):**
- `dramaScore`: a destructive event scores 90; a 3rd edit of the same file scores 45; a
  failure after a 55+ event gets the +15 compounding bump; three trivial reads apply −10.
- `shouldNarrate`: a `Read` returns false; two identical `Bash` calls 1s apart → second
  returns false; 3s apart → both true.

## Notification threshold (mobile)
Fire a push only when `dramaScore` crosses **60**, and not more than once per **90s** (a
simple `lastPushAt` timestamp in the push worker), to avoid spam during a rough patch.

## Continuity note
Every narration call gets: (1) the current event summary, (2) the last 2–3 narrated lines
(text only), (3) the active persona system prompt. It never gets the full transcript — that
is reserved for the one-shot devpost generator (triggered by an explicit
`POST /session/:id/end`), which reads the entire event log from SQLite at once.
