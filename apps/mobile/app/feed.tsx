// Feed screen (Unit G). Home surface: one SSE connection drives a drama meter + a
// newest-first card list; `audio` frames auto-enqueue on-device (queued, non-overlapping).
// Codes against Unit F's frozen interfaces only (useEventStream, audioQueue, store, api).
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { FeedItem } from "@kibitzer/shared";
import Animated from "react-native-reanimated";
import { getBase } from "../src/base";
import { useEventStream } from "../src/useEventStream";
import { audioQueue } from "../src/audioQueue";
import {
  useFeedStore,
  selectOrder,
  selectItems,
  selectSessionId,
  selectPersona,
  selectDramaScore,
} from "../src/store";
import { DramaMeter } from "../src/components/feed/DramaMeter";
import { PersonaSwitcher } from "../src/components/feed/PersonaSwitcher";
import { FeedCard } from "../src/components/feed/FeedCard";
import { ScalePressable } from "../src/components/ScalePressable";
import { StandbyDot } from "../src/components/StandbyDot";
import { colors, fonts, radius, spacing } from "../src/theme";

export default function FeedScreen() {
  const [base, setBaseState] = useState<string | null>(null);

  // Resolve the paired base (SecureStore). If somehow unpaired, bounce to pairing.
  useEffect(() => {
    getBase().then((b) => {
      if (b) setBaseState(b);
      else router.replace("/");
    });
  }, []);

  if (!base) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return <FeedConnected base={base} />;
}

// Split so the SSE hook only mounts once `base` is known (hooks can't be conditional).
function FeedConnected({ base }: { base: string }) {
  const setSession = useFeedStore((s) => s.setSession);
  const setPersonaState = useFeedStore((s) => s.setPersona);
  const upsertItem = useFeedStore((s) => s.upsertItem);
  const setScore = useFeedStore((s) => s.setScore);
  const attachAudio = useFeedStore((s) => s.attachAudio);

  const status = useEventStream(base, {
    onHello: (d) => setSession(d.sessionId),
    // replay rebuilds history on connect — store only, never enqueue (would blast the
    // whole session's audio at once on every reconnect). Only `onAudio` enqueues.
    onReplay: (d) => upsertItem(d),
    onScore: (d) => setScore(d.eventId, d.dramaScore),
    onNarration: (d) => upsertItem(d),
    onAudio: (d) => {
      // Attach for the play button AND auto-enqueue the newest line on-device.
      attachAudio(d.eventId, d.audioUrl);
      audioQueue.enqueue(`${base}${d.audioUrl}`);
    },
    onPersona: (d) => setPersonaState(d.persona),
  });

  const order = useFeedStore(selectOrder);
  const items = useFeedStore(selectItems);
  const sessionId = useFeedStore(selectSessionId);
  const persona = useFeedStore(selectPersona);
  const drama = useFeedStore(selectDramaScore);

  // Newest first (ux-flow.md). `order` is oldest→newest; reverse into a render list.
  const feed = useMemo<FeedItem[]>(() => {
    const out: FeedItem[] = [];
    for (let i = order.length - 1; i >= 0; i--) {
      const it = items[order[i]];
      if (it) out.push(it);
    }
    return out;
  }, [order, items]);

  const wrapUp = () => {
    if (sessionId) router.push("/devpost");
  };

  return (
    <View style={styles.flex}>
      <DramaMeter score={drama} />

      <View style={styles.controls}>
        <PersonaSwitcher base={base} active={persona} />
        <ScalePressable
          style={[styles.wrapBtn, !sessionId && styles.wrapBtnDisabled]}
          onPress={wrapUp}
          disabled={!sessionId}
          accessibilityRole="button"
        >
          <Text style={styles.wrapText}>Wrap up</Text>
        </ScalePressable>
      </View>

      <Animated.FlatList<FeedItem>
        data={feed}
        keyExtractor={(it) => it.event.id}
        renderItem={({ item }) => <FeedCard base={base} item={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <StandbyDot />
            <Text style={styles.emptyTitle}>
              {status === "error" ? "Disconnected — retrying…" : "Waiting for the agent…"}
            </Text>
            {status !== "error" ? (
              <Text style={styles.emptySub}>
                Narrated lines appear here the moment it starts working.
              </Text>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.panel,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  wrapBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.sm,
  },
  wrapBtnDisabled: { backgroundColor: colors.panel2, opacity: 0.6 },
  wrapText: { color: colors.onAccent, fontSize: 13, fontWeight: "800" },
  list: { padding: spacing.lg, gap: 0, flexGrow: 1 },
  sep: { height: spacing.md },
  empty: {
    alignItems: "center",
    marginTop: 56,
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.textDim,
    fontFamily: fonts.displaySemibold,
    fontSize: 14,
    textAlign: "center",
  },
  emptySub: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
});
