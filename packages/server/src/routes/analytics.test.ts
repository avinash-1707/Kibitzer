import { expect, test, describe, beforeAll } from "bun:test";
import type { Hono } from "hono";
import type { Analytics, KibitzerEvent } from "@kibitzer/shared";

// Point the store at a fresh in-memory DB BEFORE importing store.ts (which opens the DB at
// module-eval time). Dynamic imports below run after this assignment.
process.env.KIBITZER_DB = ":memory:";

let app: Hono;
let rawDb: typeof import("../store.ts").rawDb;

// Unique per run so the test is isolated even if another test file imported store.ts first
// (leaving KIBITZER_DB pointed at the real file) — no collision with existing rows.
const RUN = `test-${crypto.randomUUID()}`;
const SESSION = `${RUN}-main`;
const T0 = "2026-08-30T10:00:00.000Z";

// Seed one event row directly into SQLite (mirrors what the pipeline back-writes: dramaScore
// filled). The ring is bypassed on purpose — analytics reads SQLite, incl. Reads.
function seedEvent(
  sessionId: string,
  e: {
    id: string;
    type: KibitzerEvent["type"];
    timestamp: string;
    detail: string; // raw TEXT, so tests can inject malformed JSON
    dramaScore: number | null;
  },
): void {
  rawDb.run(
    `INSERT INTO events (id, sessionId, source, type, timestamp, detail, dramaScore)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [`${RUN}-${e.id}`, sessionId, "claude-code", e.type, e.timestamp, e.detail, e.dramaScore],
  );
}

function seed(
  e: Pick<KibitzerEvent, "id" | "type"> & {
    timestamp: string;
    detail: KibitzerEvent["detail"];
    dramaScore: number | null;
  },
): void {
  seedEvent(SESSION, { ...e, detail: JSON.stringify(e.detail) });
}

beforeAll(async () => {
  ({ rawDb } = await import("../store.ts"));
  ({ analyticsRoutes: app } = await import("./analytics.ts"));

  // startedAt drives durationMs; sessions row is normally upserted by saveEvent.
  rawDb.run(`INSERT INTO sessions (id, startedAt) VALUES (?, ?)`, [SESSION, T0]);

  seed({ id: "e1", type: "tool_call", timestamp: T0, detail: { tool: "Read", filePath: "a.ts" }, dramaScore: 2 });
  seed({ id: "e2", type: "tool_call", timestamp: "2026-08-30T10:00:10.000Z", detail: { tool: "Edit", filePath: "a.ts" }, dramaScore: 10 });
  seed({ id: "e3", type: "tool_call", timestamp: "2026-08-30T10:00:20.000Z", detail: { tool: "Edit", filePath: "a.ts" }, dramaScore: 10 });
  seed({ id: "e4", type: "tool_call", timestamp: "2026-08-30T10:00:30.000Z", detail: { tool: "Edit", filePath: "a.ts" }, dramaScore: 45 });
  seed({ id: "e5", type: "tool_call", timestamp: "2026-08-30T10:00:40.000Z", detail: { tool: "Bash", command: "npm test", outcome: "failure" }, dramaScore: 55 });
  seed({ id: "e6", type: "tool_call", timestamp: "2026-08-30T10:01:00.000Z", detail: { tool: "Bash", command: "npm test", outcome: "success" }, dramaScore: 15 });
  seed({ id: "e7", type: "tool_call", timestamp: "2026-08-30T10:01:10.000Z", detail: { tool: "Bash", command: "rm -rf dist", outcome: "success", isDestructive: true }, dramaScore: 90 });
});

async function fetchAnalytics(id = SESSION): Promise<{ status: number; body: Analytics }> {
  const res = await app.request(`/session/${id}/analytics`);
  return { status: res.status, body: (await res.json()) as Analytics };
}

describe("GET /session/:id/analytics", () => {
  test("unknown session → 404", async () => {
    const res = await app.request("/session/nope/analytics");
    expect(res.status).toBe(404);
  });

  test("toolCallsByType counts every tool_call incl. Reads", async () => {
    const { body } = await fetchAnalytics();
    expect(body.toolCallsByType).toEqual({ Read: 1, Edit: 3, Bash: 3 });
  });

  test("filesTouched counts edits per file; backtrackCount = files edited 3+ times", async () => {
    const { body } = await fetchAnalytics();
    expect(body.filesTouched).toEqual([{ path: "a.ts", editCount: 3 }]);
    expect(body.backtrackCount).toBe(1);
  });

  test("tests groups test-runner Bash calls by outcome", async () => {
    const { body } = await fetchAnalytics();
    expect(body.tests).toEqual({ pass: 1, fail: 1 });
  });

  test("riskLog holds events with dramaScore >= 55, logLine from describeEvent", async () => {
    const { body } = await fetchAnalytics();
    expect(body.riskLog.map((r) => r.eventId)).toEqual([`${RUN}-e5`, `${RUN}-e7`]);
    expect(body.riskLog[0].logLine).toBe("Bash `npm test` → FAILURE");
    expect(body.riskLog[1].logLine).toBe("Bash `rm -rf dist` → SUCCESS");
  });

  test("durationMs spans startedAt to the last event", async () => {
    const { body } = await fetchAnalytics();
    // 10:00:00 → 10:01:10 = 70s
    expect(body.durationMs).toBe(70_000);
  });

  test("riskLog threshold is inclusive at 55 and excludes 54", async () => {
    const s = `${RUN}-threshold`;
    rawDb.run(`INSERT INTO sessions (id, startedAt) VALUES (?, ?)`, [s, T0]);
    seedEvent(s, { id: "t54", type: "tool_call", timestamp: T0, detail: JSON.stringify({ tool: "Bash", command: "ls" }), dramaScore: 54 });
    seedEvent(s, { id: "t55", type: "tool_call", timestamp: "2026-08-30T10:00:01.000Z", detail: JSON.stringify({ tool: "Bash", command: "ls" }), dramaScore: 55 });
    const { body } = await fetchAnalytics(s);
    expect(body.riskLog.map((r) => r.eventId)).toEqual([`${RUN}-t55`]);
  });

  test("a row with malformed detail is skipped, not fatal", async () => {
    const s = `${RUN}-malformed`;
    rawDb.run(`INSERT INTO sessions (id, startedAt) VALUES (?, ?)`, [s, T0]);
    seedEvent(s, { id: "bad", type: "tool_call", timestamp: T0, detail: "{not json", dramaScore: 10 });
    seedEvent(s, { id: "good", type: "tool_call", timestamp: "2026-08-30T10:00:01.000Z", detail: JSON.stringify({ tool: "Bash", command: "ls" }), dramaScore: 10 });
    const { status, body } = await fetchAnalytics(s);
    expect(status).toBe(200);
    expect(body.toolCallsByType).toEqual({ Bash: 1 });
  });
});
