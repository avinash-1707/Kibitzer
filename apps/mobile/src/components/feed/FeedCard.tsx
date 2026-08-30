// One feed card (ux-flow.md §Feed): narration text, a drama-color strip, source badge,
// timestamp, a terse "what actually happened" technical line, and a play button that
// enqueues <base> + audioUrl on the shared audio queue (queued so lines never overlap).
// Entrance: fade + slide up as it lands newest-first; reflow when siblings shift.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { FeedItem } from "@kibitzer/shared";
import Animated, {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { audioQueue } from "../../audioQueue";
import { dramaColor } from "./drama";
import { ScalePressable } from "../ScalePressable";
import { colors, fonts, radius, spacing } from "../../theme";

const SOURCE_LABEL: Record<string, string> = {
  "claude-code": "Claude Code",
  opencode: "OpenCode",
  codex: "Codex",
};

/** A terse, no-LLM "what actually happened" line from the event detail. */
function describeDetail(item: FeedItem): string | null {
  const d = item.event.detail;
  const parts: string[] = [];
  if (d.tool) parts.push(d.tool);
  if (d.command) parts.push(`\`${d.command}\``);
  if (d.filePath) parts.push(d.filePath);
  if (d.outcome && d.outcome !== "unknown") parts.push(`→ ${d.outcome}`);
  return parts.length ? parts.join(" ") : null;
}

export function FeedCard({ base, item }: { base: string; item: FeedItem }) {
  const { event } = item;
  const color = dramaColor(item.dramaScore);
  const when = new Date(event.timestamp).toLocaleTimeString();
  const detail = describeDetail(item);
  // audioUrl is base-relative (e.g. "/api/tts?eventId=…"); prefix the paired <base>.
  const play = item.audioUrl ? () => audioQueue.enqueue(`${base}${item.audioUrl}`) : null;
  const badge = colors.source[event.source];

  return (
    <Animated.View
      entering={FadeInDown.duration(220).springify().damping(18)}
      layout={LinearTransition.duration(220)}
      style={styles.card}
    >
      <View style={[styles.strip, { backgroundColor: color }]} />
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text
            style={[
              styles.badge,
              badge ? { backgroundColor: badge.bg, color: badge.fg } : styles.badgeFallback,
            ]}
          >
            {SOURCE_LABEL[event.source] ?? event.source}
          </Text>
          <Text style={styles.type}>{event.type}</Text>
          <Text style={styles.time}>{when}</Text>
          <Text style={[styles.drama, { color }]}>{Math.round(item.dramaScore)}</Text>
        </View>

        {item.narration ? (
          <Text style={styles.narration}>{item.narration}</Text>
        ) : (
          <PendingText />
        )}

        {detail ? <Text style={styles.detail}>{detail}</Text> : null}

        {play ? (
          <ScalePressable style={styles.playBtn} onPress={play} accessibilityRole="button">
            <Text style={styles.playText}>▶ Play</Text>
          </ScalePressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** "narrating…" with a slow shimmer sweep — signals "in progress", not stuck. */
function PendingText() {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
  }, [t, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.7 : 0.45 + t.value * 0.4,
  }));

  return (
    <Animated.Text style={[styles.pending, style]} accessibilityLabel="narrating">
      narrating…
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  strip: { width: 4 },
  body: { flex: 1, padding: spacing.md + 2, gap: spacing.xs + 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs,
    overflow: "hidden",
  },
  badgeFallback: { backgroundColor: colors.panel2, color: colors.text },
  type: { fontSize: 12, color: colors.muted },
  time: { fontSize: 12, color: colors.muted, marginLeft: "auto" },
  drama: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  narration: { fontSize: 15, lineHeight: 21, color: colors.text },
  pending: { fontSize: 15, color: colors.textDim, fontStyle: "italic" },
  detail: { fontSize: 12.5, color: colors.muted, fontFamily: fonts.mono },
  playBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.sm,
    marginTop: 2,
  },
  playText: { color: colors.text, fontSize: 13, fontWeight: "600" },
});
