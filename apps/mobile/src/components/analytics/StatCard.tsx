// Native summary card (mobile-app.md §Analytics): a big value over a label.
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing } from "../../theme";

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 100,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  value: {
    fontFamily: fonts.displaySemibold,
    fontSize: 20,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  label: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
