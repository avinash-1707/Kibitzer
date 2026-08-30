// Pure event formatters. `describeEvent` doubles as the narration input summary and the
// Analytics risk-log line (no LLM call). `templatedFallback` is the narration used when the
// LLM is unreachable — never break the feed.
import type { KibitzerEvent } from "./event.ts";

export function describeEvent(e: KibitzerEvent): string {
  const d = e.detail;
  const outcome =
    d.outcome && d.outcome !== "unknown" ? ` → ${d.outcome.toUpperCase()}` : "";
  if (e.type === "tool_call" && d.tool === "Bash")
    return `Bash \`${d.command ?? ""}\`${outcome}`;
  if (e.type === "tool_call") return `${d.tool} ${d.filePath ?? ""}${outcome}`.trim();
  if (e.type === "file_edit") return `Edited ${d.filePath ?? "a file"}`;
  if (e.type === "turn_complete") return `Turn complete${outcome}`;
  if (e.type === "session_start") return "Session started";
  if (e.type === "session_end") return "Session ended";
  return e.type;
}

export function templatedFallback(e: KibitzerEvent): string {
  return describeEvent(e).replace(/`/g, "");
}
