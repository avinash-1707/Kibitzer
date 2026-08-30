// Feed screen (Unit G). Home surface: one SSE connection drives a drama meter + a
// newest-first card list; `audio` frames auto-enqueue on-device (queued, non-overlapping).
// Codes against Unit F's frozen interfaces only (useEventStream, audioQueue, store, api).
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import type { FeedItem } from "@kibitzer/shared";
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
        <ActivityIndicator />
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
        <TouchableOpacity
          style={[styles.wrapBtn, !sessionId && styles.wrapBtnDisabled]}
          onPress={wrapUp}
          disabled={!sessionId}
        >
          <Text style={styles.wrapText}>Wrap up</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={feed}
        keyExtractor={(it) => it.event.id}
        renderItem={({ item }) => <FeedCard base={base} item={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {status === "error"
              ? "Disconnected — retrying…"
              : "Waiting for the agent… narrated lines appear here as it works."}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f4f4f5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e2e2",
  },
  wrapBtn: {
    backgroundColor: "#c0392b",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  wrapBtnDisabled: { backgroundColor: "#ccc" },
  wrapText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  list: { padding: 16, gap: 0, flexGrow: 1 },
  sep: { height: 12 },
  empty: {
    textAlign: "center",
    color: "#888",
    fontSize: 15,
    marginTop: 48,
    paddingHorizontal: 24,
    lineHeight: 22,
  },
});
