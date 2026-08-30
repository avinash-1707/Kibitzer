// One feed card (ux-flow.md §Feed): narration text, a drama-color strip, source badge,
// timestamp, a terse "what actually happened" technical line, and a play button that
// enqueues <base> + audioUrl on the shared audio queue (queued so lines never overlap).
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { FeedItem } from "@kibitzer/shared";
import { audioQueue } from "../../audioQueue";
import { dramaColor } from "./drama";

const SOURCE_LABEL: Record<string, string> = {
  "claude-code": "Claude Code",
  opencode: "OpenCode",
  codex: "Codex",
};

/** A terse, no-LLM "what actually happened" line from the event detail. */
function describeDetail(item: FeedItem): string | null {
  const d = item.event.detail;
  const parts: string[] = [];
  if (d.tool) parts.push(d.tool);
  if (d.command) parts.push(`\`${d.command}\``);
  if (d.filePath) parts.push(d.filePath);
  if (d.outcome && d.outcome !== "unknown") parts.push(`→ ${d.outcome}`);
  return parts.length ? parts.join(" ") : null;
}

export function FeedCard({ base, item }: { base: string; item: FeedItem }) {
  const { event } = item;
  const color = dramaColor(item.dramaScore);
  const when = new Date(event.timestamp).toLocaleTimeString();
  const detail = describeDetail(item);
  // audioUrl is base-relative (e.g. "/api/tts?eventId=…"); prefix the paired <base>.
  const play = item.audioUrl ? () => audioQueue.enqueue(`${base}${item.audioUrl}`) : null;

  return (
    <View style={styles.card}>
      <View style={[styles.strip, { backgroundColor: color }]} />
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text style={styles.badge}>{SOURCE_LABEL[event.source] ?? event.source}</Text>
          <Text style={styles.type}>{event.type}</Text>
          <Text style={styles.time}>{when}</Text>
          <Text style={[styles.drama, { color }]}>{Math.round(item.dramaScore)}</Text>
        </View>

        {item.narration ? (
          <Text style={styles.narration}>{item.narration}</Text>
        ) : (
          <Text style={styles.pending}>narrating…</Text>
        )}

        {detail ? <Text style={styles.detail}>{detail}</Text> : null}

        {play ? (
          <TouchableOpacity style={styles.playBtn} onPress={play}>
            <Text style={styles.playText}>▶ Play</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e2",
  },
  strip: { width: 5 },
  body: { flex: 1, padding: 14, gap: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#333",
    backgroundColor: "#eee",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  type: { fontSize: 12, color: "#777" },
  time: { fontSize: 12, color: "#aaa", marginLeft: "auto" },
  drama: { fontSize: 13, fontWeight: "800" },
  narration: { fontSize: 16, lineHeight: 22, color: "#111" },
  pending: { fontSize: 15, color: "#999", fontStyle: "italic" },
  detail: { fontSize: 13, color: "#666", fontFamily: "Courier" },
  playBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#111",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 2,
  },
  playText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
