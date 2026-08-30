// Turn-level aggregation. A "turn" is everything an agent did in response to one user
// prompt. We narrate ONCE per turn — never per command — and the length of that narration
// scales with how much the agent actually did (its "action size"). Pure + testable: no LLM.
import { describeEvent } from "./describe.ts";
import type { KibitzerEvent } from "./event.ts";

/** A command that only inspects state (Read) is activity noise, not a narratable action. */
function isMeaningful(e: KibitzerEvent): boolean {
  if (e.type === "tool_call" && e.detail.tool === "Read") return false;
  return (
    e.type === "tool_call" || e.type === "file_edit" || e.type === "turn_complete"
  );
}

export interface TurnShape {
  meaningfulCount: number; // tool calls (non-Read) + file edits + turn completions
  failures: number; // events with outcome === "failure"
  destructive: boolean; // any server-classified destructive command
  filesTouched: number; // distinct file paths edited
  dramaPeak: number; // highest drama score seen this turn
}

/** How big was this turn? Drives the target narration length. */
export function turnShape(events: KibitzerEvent[], scores: number[]): TurnShape {
  const files = new Set<string>();
  let meaningfulCount = 0;
  let failures = 0;
  let destructive = false;
  for (const e of events) {
    if (isMeaningful(e)) meaningfulCount++;
    if (e.detail.outcome === "failure") failures++;
    if (e.detail.isDestructive) destructive = true;
    if (
      (e.type === "tool_call" || e.type === "file_edit") &&
      e.detail.filePath
    ) {
      files.add(e.detail.filePath);
    }
  }
  return {
    meaningfulCount,
    failures,
    destructive,
    filesTouched: files.size,
    dramaPeak: scores.length ? Math.max(...scores) : 0,
  };
}

export type NarrationLength = "brief" | "standard" | "big";

export interface LengthSpec {
  length: NarrationLength;
  maxTokens: number;
  guidance: string; // dropped into the prompt so length is explicit, not guessed
}

/**
 * Map a turn's action size to a target narration length. Small turns get one crisp line;
 * only genuinely eventful turns (many actions, a failure fought through, a risky command)
 * earn a longer beat. This is the whole point: no wall of text over a one-line prompt.
 */
export function lengthFor(shape: TurnShape): LengthSpec {
  const big =
    shape.meaningfulCount > 8 ||
    shape.destructive ||
    shape.failures >= 2 ||
    shape.dramaPeak >= 70;
  if (big) {
    return {
      length: "big",
      maxTokens: 320,
      guidance:
        "This was a big, eventful turn. Two or three short paragraphs — cover the arc, not every step.",
    };
  }
  const brief =
    shape.meaningfulCount <= 2 &&
    shape.failures === 0 &&
    !shape.destructive &&
    shape.dramaPeak < 40;
  if (brief) {
    return {
      length: "brief",
      maxTokens: 60,
      guidance: "This was a small turn. One crisp sentence. Do not pad it.",
    };
  }
  return {
    length: "standard",
    maxTokens: 160,
    guidance: "A short paragraph — a few sentences at most.",
  };
}

/**
 * Compact, LLM-ready summary of a turn: the meaningful actions (capped so the prompt stays
 * bounded) plus the agent's own closing message if it left one. This is what the narrator
 * talks ABOUT — it never sees raw per-command spam.
 */
export function summarizeTurn(events: KibitzerEvent[]): string {
  const meaningful = events.filter(isMeaningful);
  const actions = meaningful.filter((e) => e.type !== "turn_complete");
  const lines: string[] = [];

  // Cap the action list; on a huge turn the tail matters more than the head.
  const shown = actions.slice(-15);
  const omitted = actions.length - shown.length;
  if (omitted > 0) lines.push(`(+${omitted} earlier actions)`);
  for (const e of shown) lines.push(`- ${describeEvent(e)}`);

  const closing = events.find((e) => e.type === "turn_complete")?.detail.message;
  if (closing) lines.push(`\nAgent's closing note: ${closing}`);

  return lines.join("\n") || "- (no notable actions)";
}
