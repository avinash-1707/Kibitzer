import { expect, test, describe } from "bun:test";
import { normalizeClaudeCode } from "./claude-code.ts";

describe("normalizeClaudeCode", () => {
  test("SessionStart → session_start (no outcome)", () => {
    const e = normalizeClaudeCode({
      session_id: "sess-001",
      hook_event_name: "SessionStart",
    });
    expect(e).not.toBeNull();
    expect(e!.type).toBe("session_start");
    expect(e!.sessionId).toBe("sess-001");
    expect(e!.source).toBe("claude-code");
    expect(e!.detail.outcome).toBeUndefined();
  });

  test("PostToolUse Bash → tool_call success with command", () => {
    const e = normalizeClaudeCode({
      session_id: "sess-001",
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
    });
    expect(e!.type).toBe("tool_call");
    expect(e!.detail.outcome).toBe("success");
    expect(e!.detail.tool).toBe("Bash");
    expect(e!.detail.command).toBe("npm test");
  });

  test("PostToolUseFailure → tool_call failure", () => {
    const e = normalizeClaudeCode({
      session_id: "abc123",
      hook_event_name: "PostToolUseFailure",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
    });
    expect(e!.type).toBe("tool_call");
    expect(e!.detail.outcome).toBe("failure");
  });

  test("Edit → tool_call carries file_path as filePath", () => {
    const e = normalizeClaudeCode({
      session_id: "sess-001",
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "src/index.ts" },
    });
    expect(e!.detail.tool).toBe("Edit");
    expect(e!.detail.filePath).toBe("src/index.ts");
  });

  test("Stop → turn_complete success with last_assistant_message", () => {
    const e = normalizeClaudeCode({
      session_id: "sess-001",
      hook_event_name: "Stop",
      last_assistant_message: "All tests pass.",
    });
    expect(e!.type).toBe("turn_complete");
    expect(e!.detail.outcome).toBe("success");
    expect(e!.detail.message).toBe("All tests pass.");
  });

  test("StopFailure → turn_complete failure", () => {
    const e = normalizeClaudeCode({
      session_id: "sess-001",
      hook_event_name: "StopFailure",
    });
    expect(e!.type).toBe("turn_complete");
    expect(e!.detail.outcome).toBe("failure");
  });

  test("SessionEnd → session_end", () => {
    const e = normalizeClaudeCode({
      session_id: "sess-001",
      hook_event_name: "SessionEnd",
    });
    expect(e!.type).toBe("session_end");
  });

  test("always sets a fresh id and an ISO timestamp", () => {
    const raw = { session_id: "s", hook_event_name: "SessionStart" };
    const e = normalizeClaudeCode(raw)!;
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(() => new Date(e.timestamp).toISOString()).not.toThrow();
  });

  test("mapped events omit raw (never-shown; kept only on best-effort path)", () => {
    const e = normalizeClaudeCode({
      session_id: "s",
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls" },
    })!;
    expect(e.detail.raw).toBeUndefined();
  });

  test("Object-prototype hook names do not resolve to a mapping", () => {
    for (const name of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(
        normalizeClaudeCode({ session_id: "s", hook_event_name: name }),
      ).toBeNull();
    }
  });

  test("unmapped hook name → null (caller stores best-effort)", () => {
    expect(
      normalizeClaudeCode({ session_id: "s", hook_event_name: "PreToolUse" }),
    ).toBeNull();
  });

  test("missing session_id or hook name → null", () => {
    expect(normalizeClaudeCode({ hook_event_name: "SessionStart" })).toBeNull();
    expect(normalizeClaudeCode({ session_id: "s" })).toBeNull();
  });

  test("non-object input → null", () => {
    expect(normalizeClaudeCode(null)).toBeNull();
    expect(normalizeClaudeCode("nope")).toBeNull();
    expect(normalizeClaudeCode(42)).toBeNull();
  });
});
