// Persistent drama meter pinned to the top of the Feed (mobile-app.md §Feed).
// Driven by `score` frames (which land before narration), so it reacts first.
import { StyleSheet, Text, View } from "react-native";
import { dramaColor } from "./drama";

export function DramaMeter({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = dramaColor(pct);
  return (
    <View style={styles.meter}>
      <View style={styles.head}>
        <Text style={styles.label}>Drama</Text>
        <Text style={[styles.value, { color }]}>{Math.round(pct)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  meter: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#111",
    gap: 6,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: "#bbb", fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
  value: { fontSize: 18, fontWeight: "800" },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#333",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 3 },
});
