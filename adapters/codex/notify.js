// adapters/codex/notify.js
const raw = process.argv[process.argv.length - 1]; // payload is the LAST argv element
let e; try { e = JSON.parse(raw); } catch { process.exit(0); }
if (e.type !== "agent-turn-complete") process.exit(0);

fetch(process.env.KIBITZER_ENDPOINT ?? "http://localhost:8787/events", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    id: crypto.randomUUID(),
    sessionId: e["thread-id"],
    source: "codex",
    type: "turn_complete",
    timestamp: new Date().toISOString(),
    detail: {
      outcome: e["last-assistant-message"] ? "success" : "unknown",
      message: e["last-assistant-message"] ?? undefined,
      raw: e,
    },
  }),
}).catch(() => {}).finally(() => process.exit(0));
