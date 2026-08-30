// Wrap-up / devpost screen (Unit H). Reached from the Feed's "Wrap up" button.
// POSTs <base>/session/:id/end on mount to generate the draft from the full transcript,
// then renders { post, tweetThread }. Share uses RN's built-in Share (no new dep).
import { useEffect, useState } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import type { Devpost } from "@kibitzer/shared";
import Animated, { FadeInDown } from "react-native-reanimated";
import { getBase } from "../src/base";
import { wrapUp, getDevpost } from "../src/api";
import { useFeedStore, selectSessionId } from "../src/store";
import { ScalePressable } from "../src/components/ScalePressable";
import { Skeleton } from "../src/components/Skeleton";
import { colors, fonts, radius, spacing } from "../src/theme";

// POST /end regenerates via the LLM every call. A remount (back→forward) or React 18
// StrictMode's double-invoked effect must not re-fire that expensive generation. Track
// which sessions we've already generated; subsequent mounts read the cache (GET /devpost).
const generated = new Set<string>();

export default function DevpostScreen() {
  const sessionId = useFeedStore(selectSessionId);
  const [data, setData] = useState<Devpost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    setData(null);
    setError(null);

    getBase()
      .then((base) => {
        if (!base) throw new Error("not paired");
        // First visit for this session → generate; later visits → cheap cached read.
        const load = generated.has(sessionId)
          ? getDevpost(base, sessionId)
          : wrapUp(base, sessionId).then((d) => {
              generated.add(sessionId);
              return d;
            });
        return load;
      })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : "failed");
      });
    return () => {
      alive = false;
    };
  }, [sessionId, retry]);

  if (!sessionId) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>No active session to wrap up.</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Wrap-up failed: {error}</Text>
        <ScalePressable
          style={styles.actionBtn}
          onPress={() => {
            generated.delete(sessionId); // let the retry regenerate
            setRetry((n) => n + 1);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>Retry</Text>
        </ScalePressable>
      </View>
    );
  }
  if (!data) {
    return <DevpostSkeleton />;
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(240).springify().damping(18)} style={styles.panel}>
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>Devpost draft</Text>
          <ScalePressable
            style={styles.actionBtn}
            onPress={() => Share.share({ message: data.post })}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>Share</Text>
          </ScalePressable>
        </View>
        <Text selectable style={styles.post}>
          {data.post}
        </Text>
      </Animated.View>

      {data.tweetThread.length > 0 ? (
        <Animated.View
          entering={FadeInDown.duration(240).delay(60).springify().damping(18)}
          style={styles.panel}
        >
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Tweet thread</Text>
            <ScalePressable
              style={styles.actionBtn}
              onPress={() => Share.share({ message: data.tweetThread.join("\n\n") })}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>Share</Text>
            </ScalePressable>
          </View>
          {data.tweetThread.map((t, i) => (
            <View key={i} style={styles.tweet}>
              <Text style={styles.tweetNum}>{i + 1}</Text>
              <Text selectable style={styles.tweetText}>
                {t}
              </Text>
            </View>
          ))}
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

/** Shimmer placeholder shaped like the draft panel, shown while generating. */
function DevpostSkeleton() {
  return (
    <View style={styles.center}>
      <View style={styles.generatingCard}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="94%" height={12} />
        <Skeleton width="88%" height={12} />
        <Skeleton width="60%" height={12} />
      </View>
      <Text style={styles.generating}>Generating your devpost draft…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
  hint: { color: colors.muted, fontSize: 15, textAlign: "center" },
  generating: { color: colors.muted, fontSize: 13 },
  generatingCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  content: { padding: spacing.lg, gap: spacing.lg },
  panel: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelTitle: { fontSize: 15, fontFamily: fonts.displaySemibold, color: colors.text },
  actionBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  actionText: { color: colors.onAccent, fontSize: 13, fontWeight: "700" },
  post: { fontSize: 14, lineHeight: 21, color: colors.textDim, fontFamily: fonts.mono },
  tweet: { flexDirection: "row", gap: spacing.sm + 2 },
  tweetNum: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onAccent,
    backgroundColor: colors.accent,
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: "center",
    lineHeight: 22,
    overflow: "hidden",
  },
  tweetText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.textDim },
});
