// Risk log (ux-flow.md §Analytics): high-drama moments as plain logLines a judge can
// cross-reference. Each row: drama-color dot, the logLine, its score, and the time.
import { StyleSheet, Text, View } from "react-native";
import type { Analytics } from "@kibitzer/shared";
import Animated, { FadeIn } from "react-native-reanimated";
import { dramaColor } from "../feed/drama";
import { colors, fonts, spacing } from "../../theme";

type RiskEntry = Analytics["riskLog"][number];

export function RiskLog({ entries }: { entries: RiskEntry[] }) {
  if (entries.length === 0) {
    return <Text style={styles.empty}>No high-drama moments yet.</Text>;
  }
  return (
    <View style={styles.list}>
      {entries.map((r, i) => {
        const color = dramaColor(r.dramaScore);
        return (
          <Animated.View
            key={r.eventId}
            entering={FadeIn.duration(220).delay(i * 30)}
            style={styles.row}
          >
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={styles.line} numberOfLines={2}>
              {r.logLine}
            </Text>
            <Text style={[styles.score, { color }]}>{r.dramaScore}</Text>
            <Text style={styles.time}>
              {new Date(r.timestamp).toLocaleTimeString()}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm + 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  line: { flex: 1, fontSize: 12.5, color: colors.textDim, fontFamily: fonts.mono },
  score: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  time: { fontSize: 11, color: colors.muted, width: 68, textAlign: "right" },
  empty: { color: colors.muted, fontSize: 14, fontStyle: "italic" },
});
