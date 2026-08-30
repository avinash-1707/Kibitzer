// Owned by Unit C. Mounts GET /session/:id/analytics.
// Aggregates the SQLite event log into the Analytics tab shape (api-reference.md).
// Reads from SQLite directly (not the ring) so dropped Read/duplicate events still count.
import { Hono } from "hono";
import { describeEvent } from "@kibitzer/shared";
import type { Analytics, KibitzerEvent, KibitzerEventDetail } from "@kibitzer/shared";
import { rawDb } from "../store.ts";

export const analyticsRoutes = new Hono();

// A stored event row (detail is JSON TEXT; dramaScore nullable until the pipeline scores it).
interface EventRow {
  id: string;
  sessionId: string;
  source: string;
  type: string;
  timestamp: string;
  detail: string;
  dramaScore: number | null;
}

const selectSessionEvents = rawDb.query<EventRow, { $id: string }>(
  `SELECT id, sessionId, source, type, timestamp, detail, dramaScore
     FROM events WHERE sessionId = $id ORDER BY timestamp`,
);
const selectSessionStart = rawDb.query<
  { startedAt: string | null },
  { $id: string }
>(`SELECT startedAt FROM sessions WHERE id = $id`);

// A Bash command counts as a test run if it invokes a known test runner.
const TEST_RUNNER = /\b(test|vitest|jest|pytest|go test|cargo test)\b/;
const RISK_THRESHOLD = 55;
const BACKTRACK_EDITS = 3;

// Hydrate a row into a canonical event, reusing the detail already parsed in the loop so we
// never JSON.parse the same TEXT column twice.
function rowToEvent(r: EventRow, detail: KibitzerEventDetail): KibitzerEvent {
  return {
    id: r.id,
    sessionId: r.sessionId,
    source: r.source as KibitzerEvent["source"],
    type: r.type as KibitzerEvent["type"],
    timestamp: r.timestamp,
    detail,
  };
}

function isFileEdit(type: string, tool: string | undefined): boolean {
  return type === "file_edit" || (type === "tool_call" && (tool === "Edit" || tool === "Write"));
}

analyticsRoutes.get("/session/:id/analytics", (c) => {
  const sessionId = c.req.param("id");
  const rows = selectSessionEvents.all({ $id: sessionId });
  if (rows.length === 0) return c.json({ error: "unknown session" }, 404);

  const toolCallsByType: Record<string, number> = {};
  const editCounts = new Map<string, number>();
  const tests = { pass: 0, fail: 0 };
  const riskLog: Analytics["riskLog"] = [];

  for (const r of rows) {
    // `detail` is a TEXT column written by other units; a malformed row degrades to {}
    // rather than 500-ing the whole summary.
    let detail: KibitzerEventDetail;
    try {
      detail = r.detail ? (JSON.parse(r.detail) as KibitzerEventDetail) : {};
    } catch {
      continue;
    }

    if (r.type === "tool_call" && detail.tool) {
      toolCallsByType[detail.tool] = (toolCallsByType[detail.tool] ?? 0) + 1;
    }

    if (isFileEdit(r.type, detail.tool) && detail.filePath) {
      editCounts.set(detail.filePath, (editCounts.get(detail.filePath) ?? 0) + 1);
    }

    if (r.type === "tool_call" && detail.tool === "Bash" && detail.command && TEST_RUNNER.test(detail.command)) {
      if (detail.outcome === "failure") tests.fail += 1;
      else if (detail.outcome === "success") tests.pass += 1;
    }

    if (r.dramaScore !== null && r.dramaScore >= RISK_THRESHOLD) {
      riskLog.push({
        eventId: r.id,
        timestamp: r.timestamp,
        logLine: describeEvent(rowToEvent(r, detail)),
        dramaScore: r.dramaScore,
      });
    }
  }

  const filesTouched = [...editCounts.entries()]
    .map(([path, editCount]) => ({ path, editCount }))
    .sort((a, b) => b.editCount - a.editCount);

  const backtrackCount = filesTouched.filter((f) => f.editCount >= BACKTRACK_EDITS).length;

  const startedAt = selectSessionStart.get({ $id: sessionId })?.startedAt ?? rows[0].timestamp;
  const lastTs = rows[rows.length - 1].timestamp;
  const durationMs = Math.max(0, Date.parse(lastTs) - Date.parse(startedAt));

  const analytics: Analytics = {
    sessionId,
    durationMs,
    toolCallsByType,
    filesTouched,
    tests,
    backtrackCount,
    riskLog,
  };
  return c.json(analytics);
});
