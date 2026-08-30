// toolCallsByType as simple native bars, most-frequent first (mobile-app.md §Analytics).
import { StyleSheet, Text, View } from "react-native";

export function ToolBreakdown({ byType }: { byType: Record<string, number> }) {
  const rows = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, [, n]) => a + n, 0);

  if (rows.length === 0) {
    return <Text style={styles.empty}>No tool calls yet.</Text>;
  }

  return (
    <View style={styles.list}>
      {rows.map(([tool, count]) => (
        <View key={tool} style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>
            {tool}
          </Text>
          <View style={styles.track}>
            <View
              style={[styles.fill, { width: total ? `${(count / total) * 100}%` : "0%" }]}
            />
          </View>
          <Text style={styles.count}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { width: 84, fontSize: 13, color: "#333", fontWeight: "600" },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#eee",
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: "#111", borderRadius: 4 },
  count: { width: 28, textAlign: "right", fontSize: 13, color: "#555", fontWeight: "700" },
  empty: { color: "#999", fontSize: 14, fontStyle: "italic" },
});
