import { expect, test, describe } from "bun:test";
import { dramaScore, shouldNarrate } from "./drama.ts";
import type { KibitzerEvent } from "./event.ts";

function ev(partial: Partial<KibitzerEvent> & { detail?: KibitzerEvent["detail"] }): KibitzerEvent {
  return {
    id: partial.id ?? crypto.randomUUID(),
    sessionId: partial.sessionId ?? "s1",
    source: partial.source ?? "claude-code",
    type: partial.type ?? "tool_call",
    timestamp: partial.timestamp ?? new Date().toISOString(),
    detail: partial.detail ?? {},
  };
}

describe("dramaScore", () => {
  test("destructive event scores 90", () => {
    const e = ev({ type: "tool_call", detail: { tool: "Bash", command: "rm -rf dist", isDestructive: true } });
    expect(dramaScore(e, [], [])).toBe(90);
  });

  test("3rd edit of the same file scores 45 (backtrack)", () => {
    const prior = [
      ev({ type: "tool_call", detail: { tool: "Edit", filePath: "a.ts" } }),
      ev({ type: "tool_call", detail: { tool: "Edit", filePath: "a.ts" } }),
    ];
    const third = ev({ type: "tool_call", detail: { tool: "Edit", filePath: "a.ts" } });
    expect(dramaScore(third, prior, [10, 10])).toBe(45);
  });

  test("first edit of a file scores 10", () => {
    const e = ev({ type: "tool_call", detail: { tool: "Write", filePath: "new.ts" } });
    expect(dramaScore(e, [], [])).toBe(10);
  });

  test("Bash failure after a 55+ event gets +15 compounding", () => {
    const e = ev({ type: "tool_call", detail: { tool: "Bash", command: "npm test", outcome: "failure" } });
    // base 55 + 15 (last score >= 50) = 70
    expect(dramaScore(e, [ev({})], [55])).toBe(70);
  });

  test("three trivial reads apply -10 cool-down (but Read base is 2, so modifiers skipped)", () => {
    // Read base is 2, which is NOT > 2, so modifiers don't apply — stays 2.
    const read = ev({ type: "tool_call", detail: { tool: "Read", filePath: "x.ts" } });
    expect(dramaScore(read, [ev({}), ev({}), ev({})], [5, 5, 5])).toBe(2);
  });

  test("cool-down applies to a scoreable event after 3 low scores", () => {
    // Bash success base 15; last 3 scores all < 15 → -10 → 5
    const e = ev({ type: "tool_call", detail: { tool: "Bash", command: "ls", outcome: "success" } });
    expect(dramaScore(e, [ev({}), ev({}), ev({})], [2, 5, 10])).toBe(5);
  });
});

describe("shouldNarrate", () => {
  test("Read tool call returns false", () => {
    const e = ev({ type: "tool_call", detail: { tool: "Read", filePath: "x.ts" } });
    expect(shouldNarrate(e, [])).toBe(false);
  });

  test("two identical Bash calls 1s apart → second returns false", () => {
    const t0 = "2026-08-30T11:00:00.000Z";
    const t1 = "2026-08-30T11:00:01.000Z"; // 1s later
    const first = ev({ id: "a", type: "tool_call", timestamp: t0, detail: { tool: "Bash", command: "ls" } });
    const second = ev({ id: "b", type: "tool_call", timestamp: t1, detail: { tool: "Bash", command: "ls" } });
    expect(shouldNarrate(second, [first])).toBe(false);
  });

  test("two identical Bash calls 3s apart → both narrate", () => {
    const t0 = "2026-08-30T11:00:00.000Z";
    const t3 = "2026-08-30T11:00:03.000Z"; // 3s later, outside 2s window
    const first = ev({ id: "a", type: "tool_call", timestamp: t0, detail: { tool: "Bash", command: "ls" } });
    const second = ev({ id: "b", type: "tool_call", timestamp: t3, detail: { tool: "Bash", command: "ls" } });
    expect(shouldNarrate(first, [])).toBe(true);
    expect(shouldNarrate(second, [first])).toBe(true);
  });

  test("never matches self even if passed in recent", () => {
    const e = ev({ id: "same", type: "tool_call", detail: { tool: "Bash", command: "ls" } });
    expect(shouldNarrate(e, [e])).toBe(true);
  });
});
