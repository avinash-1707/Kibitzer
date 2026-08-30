// Wrap-up / devpost screen (Unit H). Reached from the Feed's "Wrap up" button.
// POSTs <base>/session/:id/end on mount to generate the draft from the full transcript,
// then renders { post, tweetThread }. Share uses RN's built-in Share (no new dep).
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Devpost } from "@kibitzer/shared";
import { getBase } from "../src/base";
import { wrapUp, getDevpost } from "../src/api";
import { useFeedStore, selectSessionId } from "../src/store";

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
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => {
            generated.delete(sessionId); // let the retry regenerate
            setRetry((n) => n + 1);
          }}
        >
          <Text style={styles.shareText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.generating}>Generating your devpost draft…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>Devpost draft</Text>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => Share.share({ message: data.post })}
          >
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>
        </View>
        <Text selectable style={styles.post}>
          {data.post}
        </Text>
      </View>

      {data.tweetThread.length > 0 ? (
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Tweet thread</Text>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => Share.share({ message: data.tweetThread.join("\n\n") })}
            >
              <Text style={styles.shareText}>Share</Text>
            </TouchableOpacity>
          </View>
          {data.tweetThread.map((t, i) => (
            <View key={i} style={styles.tweet}>
              <Text style={styles.tweetNum}>{i + 1}</Text>
              <Text selectable style={styles.tweetText}>
                {t}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f4f4f5" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  hint: { color: "#888", fontSize: 15, textAlign: "center" },
  generating: { color: "#888", fontSize: 14 },
  content: { padding: 16, gap: 16 },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e2e2",
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelTitle: { fontSize: 15, fontWeight: "700", color: "#111" },
  shareBtn: {
    backgroundColor: "#111",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  shareText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  post: { fontSize: 15, lineHeight: 22, color: "#222" },
  tweet: { flexDirection: "row", gap: 10 },
  tweetNum: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
    backgroundColor: "#1da1f2",
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: "center",
    lineHeight: 22,
    overflow: "hidden",
  },
  tweetText: { flex: 1, fontSize: 14, lineHeight: 20, color: "#222" },
});
