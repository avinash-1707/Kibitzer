// toolCallsByType as simple native bars, most-frequent first (mobile-app.md §Analytics).
// Each bar animates its width in on mount/update.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors, radius, spacing } from "../../theme";

export function ToolBreakdown({ byType }: { byType: Record<string, number> }) {
  const rows = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, [, n]) => a + n, 0);

  if (rows.length === 0) {
    return <Text style={styles.empty}>No tool calls yet.</Text>;
  }

  return (
    <View style={styles.list}>
      {rows.map(([tool, count]) => (
        <Row key={tool} tool={tool} pct={total ? (count / total) * 100 : 0} count={count} />
      ))}
    </View>
  );
}

function Row({ tool, pct, count }: { tool: string; pct: number; count: number }) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = reduceMotion
      ? withTiming(pct / 100, { duration: 0 })
      : withSpring(pct / 100, { stiffness: 120, damping: 20 });
  }, [pct, reduceMotion, scale]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(scale.value, 0.001) }],
  }));

  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>
        {tool}
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      <Text style={styles.count}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { width: 84, fontSize: 13, color: colors.textDim, fontWeight: "600" },
  track: {
    flex: 1,
    height: 7,
    borderRadius: radius.xs,
    backgroundColor: colors.panel2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    width: "100%",
    backgroundColor: colors.accent,
    borderRadius: radius.xs,
    transformOrigin: "left",
  },
  count: {
    width: 28,
    textAlign: "right",
    fontSize: 13,
    color: colors.muted,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  empty: { color: colors.muted, fontSize: 14, fontStyle: "italic" },
});
