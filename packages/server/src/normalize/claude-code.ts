// Owned by Unit B. Signature FROZEN by Unit 0.
// Maps a raw Claude Code hook payload → canonical KibitzerEvent (see event-schema.md).
import type {
  EventType,
  KibitzerEvent,
  KibitzerEventDetail,
  Outcome,
} from "@kibitzer/shared";

// hook_event_name → canonical type (+ outcome). See event-schema.md mapping table.
const HOOK_MAP: Record<string, { type: EventType; outcome?: Outcome }> = {
  SessionStart: { type: "session_start" },
  PostToolUse: { type: "tool_call", outcome: "success" },
  PostToolUseFailure: { type: "tool_call", outcome: "failure" },
  Stop: { type: "turn_complete", outcome: "success" },
  StopFailure: { type: "turn_complete", outcome: "failure" },
  SessionEnd: { type: "session_end" },
};

interface RawClaudeHook {
  session_id?: unknown;
  hook_event_name?: unknown;
  tool_name?: unknown;
  tool_input?: { command?: unknown; file_path?: unknown } | null;
  last_assistant_message?: unknown;
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

/**
 * Normalize a raw Claude Code hook body into a canonical event.
 * Returns null if the payload can't be mapped (caller stores it best-effort).
 */
export function normalizeClaudeCode(raw: unknown): KibitzerEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const hook = raw as RawClaudeHook;

  const sessionId = str(hook.session_id);
  const hookName = str(hook.hook_event_name);
  if (!sessionId || !hookName) return null;

  // Own-property lookup only — a hook_event_name of "constructor"/"toString" must not
  // resolve to an inherited Object member and slip through as a malformed event.
  const mapped = Object.hasOwn(HOOK_MAP, hookName) ? HOOK_MAP[hookName] : undefined;
  if (!mapped) return null; // caller stores best-effort with raw set

  // `raw` is intentionally omitted for mapped events: it's documented as never-shown and
  // would bloat every SSE frame. It's kept only on the best-effort path (see route), where
  // the unmapped payload is the whole point of storing.
  const detail: KibitzerEventDetail = {};
  if (mapped.outcome) detail.outcome = mapped.outcome;

  const tool = str(hook.tool_name);
  if (tool) detail.tool = tool;

  const command = str(hook.tool_input?.command);
  if (command) detail.command = command;

  const filePath = str(hook.tool_input?.file_path);
  if (filePath) detail.filePath = filePath;

  const message = str(hook.last_assistant_message);
  if (message) detail.message = message;

  return {
    id: crypto.randomUUID(),
    sessionId,
    source: "claude-code",
    type: mapped.type,
    timestamp: new Date().toISOString(),
    detail,
  };
}
