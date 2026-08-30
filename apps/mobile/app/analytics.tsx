// Analytics screen (Unit H). GET <base>/session/:id/analytics on mount + 5s poll.
// sessionId comes from the store's `hello` frame (set by the Feed's SSE connection).
// Codes against Unit F's frozen api.getAnalytics + store selector only.
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { Analytics } from "@kibitzer/shared";
import Animated, { FadeInDown } from "react-native-reanimated";
import { getBase } from "../src/base";
import { getAnalytics } from "../src/api";
import { useFeedStore, selectSessionId } from "../src/store";
import { StatCard } from "../src/components/analytics/StatCard";
import { ToolBreakdown } from "../src/components/analytics/ToolBreakdown";
import { RiskLog } from "../src/components/analytics/RiskLog";
import { Skeleton } from "../src/components/Skeleton";
import { StandbyDot } from "../src/components/StandbyDot";
import { colors, fonts, radius, spacing } from "../src/theme";

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default function AnalyticsScreen() {
  const sessionId = useFeedStore(selectSessionId);
  const [base, setBaseState] = useState<string | null>(null);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBase().then((b) => {
      if (b) setBaseState(b);
      else router.replace("/"); // unpaired (e.g. deep-link / locked keychain) → re-pair
    });
  }, []);

  useEffect(() => {
    if (!base || !sessionId) return;
    let alive = true;
    let seq = 0; // drop out-of-order responses: only the latest issued poll may write.
    setData(null); // clear stale data when session changes (no cross-session bleed)

    const load = () => {
      const mine = ++seq;
      return getAnalytics(base, sessionId)
        .then((a) => {
          if (alive && mine === seq) {
            setData(a);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (alive && mine === seq) setError(e instanceof Error ? e.message : "failed");
        });
    };

    load(); // on mount
    const id = setInterval(load, 5000); // poll ~5s (mobile-app.md §Analytics)
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [base, sessionId]);

  if (!sessionId) {
    return (
      <View style={styles.center}>
        <StandbyDot />
        <Text style={styles.emptyTitle}>No active session yet.</Text>
        <Text style={styles.emptySub}>Analytics populate once an agent connects.</Text>
      </View>
    );
  }
  if (error && !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Analytics unavailable</Text>
        <Text style={styles.emptySub}>{error}</Text>
      </View>
    );
  }
  if (!data) {
    return <AnalyticsSkeleton />;
  }

  const totalCalls = Object.values(data.toolCallsByType).reduce((a, b) => a + b, 0);
  const stats: { label: string; value: string | number }[] = [
    { label: "Tool calls", value: totalCalls },
    { label: "Files", value: data.filesTouched.length },
    { label: "Tests", value: `${data.tests.pass}✓ / ${data.tests.fail}✗` },
    { label: "Duration", value: formatDuration(data.durationMs) },
    { label: "Backtracks", value: data.backtrackCount },
  ];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.cards}>
        {stats.map(({ label, value }, i) => (
          <Animated.View
            key={label}
            entering={FadeInDown.duration(240).delay(i * 40).springify().damping(18)}
            style={styles.cardWrap}
          >
            <StatCard label={label} value={value} />
          </Animated.View>
        ))}
      </View>

      <Section title="Tool calls by type">
        <ToolBreakdown byType={data.toolCallsByType} />
      </Section>

      <Section title="Files touched">
        {data.filesTouched.length === 0 ? (
          <Text style={styles.empty}>None yet.</Text>
        ) : (
          <View style={styles.files}>
            {data.filesTouched.map((f) => (
              <View key={f.path} style={styles.fileRow}>
                <Text style={styles.filePath} numberOfLines={1}>
                  {f.path}
                </Text>
                <Text style={styles.fileCount}>{f.editCount}×</Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section title="Risk log">
        <RiskLog entries={data.riskLog} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Shimmer placeholders shaped like the real layout, shown while `data` is null. */
function AnalyticsSkeleton() {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.cards}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View style={[styles.card, styles.statSkel]} key={i}>
            <Skeleton width={44} height={22} radius={radius.sm} />
            <Skeleton width={64} height={9} />
          </View>
        ))}
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Tool calls by type</Text>
        <View style={styles.files}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.skelBarRow}>
              <Skeleton width={48} height={12} />
              <View style={styles.skelBarTrack}>
                <Skeleton width="100%" height={7} radius={radius.xs} />
              </View>
              <Skeleton width={20} height={12} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Files touched</Text>
        <View style={styles.files}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width={`${70 - i * 8}%`} height={12} />
          ))}
        </View>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Risk log</Text>
        <View style={styles.files}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} width={`${85 - i * 12}%`} height={12} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  emptyTitle: { color: colors.textDim, fontFamily: fonts.displaySemibold, fontSize: 15, textAlign: "center" },
  emptySub: { color: colors.muted, fontSize: 13, textAlign: "center", maxWidth: 280 },
  content: { padding: spacing.lg, gap: spacing.lg },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm + 2 },
  cardWrap: { flexGrow: 1, flexBasis: "30%", minWidth: 100 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statSkel: { flexGrow: 1, flexBasis: "30%", minWidth: 100, alignItems: "center", gap: spacing.sm },
  panel: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  files: { gap: spacing.sm },
  fileRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  filePath: { flex: 1, fontSize: 13, color: colors.textDim, fontFamily: fonts.mono },
  fileCount: { fontSize: 13, color: colors.muted, fontWeight: "700" },
  empty: { color: colors.muted, fontSize: 14, fontStyle: "italic" },
  skelBarRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  skelBarTrack: { flex: 1 },
});
