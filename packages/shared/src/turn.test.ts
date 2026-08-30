import { expect, test, describe } from "bun:test";
import { lengthFor, summarizeTurn, turnShape } from "./turn.ts";
import type { KibitzerEvent } from "./event.ts";

function ev(p: Partial<KibitzerEvent> & { detail?: KibitzerEvent["detail"] }): KibitzerEvent {
  return {
    id: p.id ?? crypto.randomUUID(),
    sessionId: p.sessionId ?? "s1",
    source: p.source ?? "claude-code",
    type: p.type ?? "tool_call",
    timestamp: p.timestamp ?? "2026-08-30T11:00:00.000Z",
    detail: p.detail ?? {},
  };
}

const bash = (detail: KibitzerEvent["detail"]) => ev({ type: "tool_call", detail });

describe("turnShape", () => {
  test("Read calls don't count as meaningful actions", () => {
    const s = turnShape(
      [bash({ tool: "Read", filePath: "a.ts" }), bash({ tool: "Edit", filePath: "a.ts" })],
      [2, 10],
    );
    expect(s.meaningfulCount).toBe(1);
  });

  test("counts failures, destructive, distinct files, drama peak", () => {
    const s = turnShape(
      [
        bash({ tool: "Bash", command: "npm test", outcome: "failure" }),
        bash({ tool: "Edit", filePath: "a.ts" }),
        bash({ tool: "Edit", filePath: "b.ts" }),
        bash({ tool: "Bash", command: "rm -rf /", isDestructive: true }),
      ],
      [55, 10, 10, 90],
    );
    expect(s.failures).toBe(1);
    expect(s.destructive).toBe(true);
    expect(s.filesTouched).toBe(2);
    expect(s.dramaPeak).toBe(90);
  });
});

describe("lengthFor", () => {
  test("a one-action, calm turn is brief", () => {
    const s = turnShape([bash({ tool: "Edit", filePath: "a.ts" })], [10]);
    expect(lengthFor(s).length).toBe("brief");
  });

  test("a destructive turn is big even if tiny", () => {
    const s = turnShape([bash({ tool: "Bash", command: "rm -rf x", isDestructive: true })], [90]);
    expect(lengthFor(s).length).toBe("big");
  });

  test("two failures push to big", () => {
    const s = turnShape(
      [
        bash({ tool: "Bash", command: "npm test", outcome: "failure" }),
        bash({ tool: "Bash", command: "npm test", outcome: "failure" }),
      ],
      [55, 55],
    );
    expect(lengthFor(s).length).toBe("big");
  });

  test("a handful of clean edits is standard", () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      bash({ tool: "Edit", filePath: `f${i}.ts` }),
    );
    const s = turnShape(events, events.map(() => 10));
    expect(lengthFor(s).length).toBe("standard");
  });
});

describe("summarizeTurn", () => {
  test("lists meaningful actions and appends the agent's closing note", () => {
    const out = summarizeTurn([
      bash({ tool: "Read", filePath: "skip.ts" }),
      bash({ tool: "Bash", command: "npm test", outcome: "failure" }),
      ev({ type: "turn_complete", detail: { message: "Fixed the failing test." } }),
    ]);
    expect(out).toContain("Bash `npm test` → FAILURE");
    expect(out).not.toContain("skip.ts"); // Read is filtered out
    expect(out).toContain("Agent's closing note: Fixed the failing test.");
  });

  test("caps the action list and reports how many were omitted", () => {
    const events = Array.from({ length: 20 }, (_, i) =>
      bash({ tool: "Edit", filePath: `f${i}.ts` }),
    );
    const out = summarizeTurn(events);
    expect(out).toContain("(+5 earlier actions)"); // 20 - 15 shown
  });
});
