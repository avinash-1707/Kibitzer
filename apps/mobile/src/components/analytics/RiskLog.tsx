// Risk log (ux-flow.md §Analytics): high-drama moments as plain logLines a judge can
// cross-reference. Each row: drama-color dot, the logLine, its score, and the time.
import { StyleSheet, Text, View } from "react-native";
import type { Analytics } from "@kibitzer/shared";
import { dramaColor } from "../feed/drama";

type RiskEntry = Analytics["riskLog"][number];

export function RiskLog({ entries }: { entries: RiskEntry[] }) {
  if (entries.length === 0) {
    return <Text style={styles.empty}>No high-drama moments yet.</Text>;
  }
  return (
    <View style={styles.list}>
      {entries.map((r) => {
        const color = dramaColor(r.dramaScore);
        return (
          <View key={r.eventId} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={styles.line}>{r.logLine}</Text>
            <Text style={[styles.score, { color }]}>{r.dramaScore}</Text>
            <Text style={styles.time}>
              {new Date(r.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { flex: 1, fontSize: 13, color: "#333" },
  score: { fontSize: 13, fontWeight: "800" },
  time: { fontSize: 11, color: "#aaa", width: 68, textAlign: "right" },
  empty: { color: "#999", fontSize: 14, fontStyle: "italic" },
});
