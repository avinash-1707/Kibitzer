// Analytics screen (Unit H). GET <base>/session/:id/analytics on mount + 5s poll.
// sessionId comes from the store's `hello` frame (set by the Feed's SSE connection).
// Codes against Unit F's frozen api.getAnalytics + store selector only.
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import type { Analytics } from "@kibitzer/shared";
import { getBase } from "../src/base";
import { getAnalytics } from "../src/api";
import { useFeedStore, selectSessionId } from "../src/store";
import { StatCard } from "../src/components/analytics/StatCard";
import { ToolBreakdown } from "../src/components/analytics/ToolBreakdown";
import { RiskLog } from "../src/components/analytics/RiskLog";

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
        <Text style={styles.hint}>No active session yet.</Text>
      </View>
    );
  }
  if (error && !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Analytics unavailable: {error}</Text>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const totalCalls = Object.values(data.toolCallsByType).reduce((a, b) => a + b, 0);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.cards}>
        <StatCard label="Tool calls" value={totalCalls} />
        <StatCard label="Files" value={data.filesTouched.length} />
        <StatCard label="Tests" value={`${data.tests.pass}✓ / ${data.tests.fail}✗`} />
        <StatCard label="Duration" value={formatDuration(data.durationMs)} />
        <StatCard label="Backtracks" value={data.backtrackCount} />
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f4f4f5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  hint: { color: "#888", fontSize: 15, textAlign: "center" },
  content: { padding: 16, gap: 16 },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e2",
  },
  panelTitle: { fontSize: 15, fontWeight: "700", color: "#111" },
  files: { gap: 8 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filePath: { flex: 1, fontSize: 13, color: "#333", fontFamily: "Courier" },
  fileCount: { fontSize: 13, color: "#555", fontWeight: "700" },
  empty: { color: "#999", fontSize: 14, fontStyle: "italic" },
});
