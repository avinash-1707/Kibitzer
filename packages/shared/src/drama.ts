// Drama meter + debounce predicate. Pure, instant, free, unit-testable — never calls an LLM.
//
// Convention: `recent` and `scores` are events/scores from BEFORE this event (they do NOT
// include the current event). `recent[i]` and `scores[i]` are aligned.
import type { KibitzerEvent } from "./event.ts";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// How many times this file was edited in `recent` (prior events only). Handles undefined.
function editCountForFile(
  filePath: string | undefined,
  recent: KibitzerEvent[],
): number {
  if (!filePath) return 0;
  return recent.filter(
    (r) =>
      (r.type === "tool_call" || r.type === "file_edit") &&
      r.detail.filePath === filePath,
  ).length;
}

export function dramaScore(
  event: KibitzerEvent,
  recent: KibitzerEvent[], // PRIOR events oldest→newest
  scores: number[], // PRIOR scores oldest→newest, aligned with `recent`
): number {
  const base = baseScore(event, recent);
  let score = base;
  // Modifiers only apply to events interesting enough to be narrated (skip Read/dupe noise).
  if (base > 2) {
    const last = scores.at(-1);
    if (last !== undefined && last >= 50) score += 15; // compounding drama
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
  if (e.type === "tool_call" && d.tool === "Bash")
    return d.outcome === "failure" ? 55 : 15;
  if (e.type === "turn_complete") return d.outcome === "failure" ? 55 : 5;
  if (e.type === "session_end") return 20; // small closing beat
  if (e.type === "file_edit") return 10;
  return 5;
}

// Skip narration (but still store) for Read-type calls and duplicate bursts within 2s.
// `recent` is PRIOR events only, so the event is never compared against itself.
export function shouldNarrate(e: KibitzerEvent, recent: KibitzerEvent[]): boolean {
  if (e.type === "tool_call" && e.detail.tool === "Read") return false;
  const twoSecAgo = Date.parse(e.timestamp) - 2000;
  const dupe = recent.some(
    (r) =>
      r.id !== e.id && // defensive: never match self
      r.type === e.type &&
      r.detail.tool === e.detail.tool &&
      Date.parse(r.timestamp) >= twoSecAgo,
  );
  return !dupe;
}
