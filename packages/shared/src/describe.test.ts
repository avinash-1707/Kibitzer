import { expect, test, describe } from "bun:test";
import { describeEvent, templatedFallback } from "./describe.ts";
import type { KibitzerEvent } from "./event.ts";

function ev(p: Partial<KibitzerEvent> & { detail?: KibitzerEvent["detail"] }): KibitzerEvent {
  return {
    id: p.id ?? "e",
    sessionId: p.sessionId ?? "s1",
    source: p.source ?? "claude-code",
    type: p.type ?? "tool_call",
    timestamp: p.timestamp ?? "2026-08-30T11:00:00.000Z",
    detail: p.detail ?? {},
  };
}

describe("describeEvent", () => {
  test("Bash with outcome", () => {
    expect(
      describeEvent(ev({ type: "tool_call", detail: { tool: "Bash", command: "npm test", outcome: "failure" } })),
    ).toBe("Bash `npm test` → FAILURE");
  });

  test("Bash unknown outcome omits arrow", () => {
    expect(
      describeEvent(ev({ type: "tool_call", detail: { tool: "Bash", command: "ls", outcome: "unknown" } })),
    ).toBe("Bash `ls`");
  });

  test("non-Bash tool call with file", () => {
    expect(
      describeEvent(ev({ type: "tool_call", detail: { tool: "Edit", filePath: "a.ts", outcome: "success" } })),
    ).toBe("Edit a.ts → SUCCESS");
  });

  test("file_edit", () => {
    expect(describeEvent(ev({ type: "file_edit", detail: { filePath: "x.ts" } }))).toBe("Edited x.ts");
  });

  test("turn_complete / session_start / session_end", () => {
    expect(describeEvent(ev({ type: "turn_complete", detail: { outcome: "success" } }))).toBe("Turn complete → SUCCESS");
    expect(describeEvent(ev({ type: "session_start" }))).toBe("Session started");
    expect(describeEvent(ev({ type: "session_end" }))).toBe("Session ended");
  });
});

describe("templatedFallback", () => {
  test("strips backticks from describeEvent output", () => {
    expect(
      templatedFallback(ev({ type: "tool_call", detail: { tool: "Bash", command: "npm test", outcome: "failure" } })),
    ).toBe("Bash npm test → FAILURE");
  });
});
