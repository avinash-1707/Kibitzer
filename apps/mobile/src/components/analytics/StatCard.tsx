// Native summary card (mobile-app.md §Analytics): a big value over a label.
import { StyleSheet, Text, View } from "react-native";

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
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e2",
    alignItems: "flex-start",
    gap: 4,
  },
  value: { fontSize: 22, fontWeight: "800", color: "#111" },
  label: { fontSize: 12, color: "#777", textTransform: "uppercase", letterSpacing: 0.4 },
});
