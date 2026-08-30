// .opencode/plugins/kibitzer.ts
import type { Plugin } from "@opencode-ai/plugin"; // @opencode-ai/plugin@1.18.25

const ENDPOINT = process.env.KIBITZER_ENDPOINT ?? "http://localhost:8787/events";

// file.edited carries no session id, so track the latest one seen on tool/session events.
let currentSessionId = "unknown";

function mk(sessionId: string, type: string, detail: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    sessionId,
    source: "opencode",
    type,
    timestamp: new Date().toISOString(),
    detail,
  };
}

async function emit(body: unknown) {
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    /* collector down — never block the agent */
  }
}

export const Kibitzer: Plugin = async () => ({
  "tool.execute.after": async (input, output) => {
    // input: { tool, sessionID, callID, args }; output: { title, output, metadata }
    currentSessionId = input.sessionID;
    await emit(mk(input.sessionID, "tool_call", {
      tool: input.tool,
      command: input.args?.command,
      filePath: input.args?.filePath ?? input.args?.file_path,
      outcome: "success", // reaching `.after` implies the tool ran
      raw: { args: input.args, output: output.output },
    }));
  },
  event: async ({ event }) => {
    if (event.type === "session.created") {
      currentSessionId = event.properties.info.id;
      await emit(mk(currentSessionId, "session_start"));
    } else if (event.type === "session.status" && event.properties.status?.type === "idle") {
      // per-TURN idle → turn_complete (NOT session_end; the session isn't over)
      await emit(mk(event.properties.sessionID, "turn_complete", { outcome: "success" }));
    } else if (event.type === "file.edited" && currentSessionId !== "unknown") {
      await emit(mk(currentSessionId, "file_edit", { filePath: event.properties.file }));
    }
  },
});
