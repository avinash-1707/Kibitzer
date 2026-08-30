// Persistent drama meter pinned to the top of the Feed (mobile-app.md §Feed).
// Driven by `score` frames (which land before narration), so it reacts first.
// A spring-driven shared value powers both the fill and the rolling number —
// one physical motion instead of two things separately snapping to place.
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { dramaColor } from "./drama";
import { colors, fonts, radius, spacing } from "../../theme";

export function DramaMeter({ score }: { score: number }) {
  // Guard against a non-finite score (e.g. a transient null/NaN from the store
  // before the first `score` frame): NaN would poison the spring and render
  // `scaleX: NaN`, which is a hard native throw on Android.
  const pct = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const color = dramaColor(pct);
  const hot = pct >= 70;
  const reduceMotion = useReducedMotion();

  const progress = useSharedValue(pct);
  const [displayed, setDisplayed] = useState(Math.round(pct));

  useEffect(() => {
    progress.value = reduceMotion
      ? withTiming(pct, { duration: 0 })
      : withSpring(pct, { stiffness: 140, damping: 24, mass: 0.6 });
  }, [pct, progress, reduceMotion]);

  // Mirror the animated value into plain state so <Text> can render a rolling
  // number — reanimated can't drive text content directly on native.
  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, previous) => {
      if (current !== previous) runOnJS(setDisplayed)(current);
    },
  );

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(progress.value / 100, 0.001) }],
  }));

  // Subtle glow pulse on high tension — a purposeful signal ("this matters
  // right now"), not decorative noise, and gated off under reduced motion.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (hot && !reduceMotion) {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900 }),
          withTiming(0.3, { duration: 900 }),
        ),
        -1,
        true,
      );
    } else {
      // Stop the infinite repeat before easing back to 0, otherwise the loop
      // keeps driving the value after `hot` flips false.
      cancelAnimation(glow);
      glow.value = withTiming(0, { duration: 200 });
    }
    // Cancel on unmount too — an infinite withRepeat left running holds the value.
    return () => cancelAnimation(glow);
  }, [hot, reduceMotion, glow]);

  // Shadow lives on a wrapper (not the clipped track) so the glow isn't cut
  // off by the track's `overflow: hidden`.
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glow.value * 0.6,
  }));

  return (
    <View style={styles.meter}>
      <View style={styles.head}>
        <Text style={styles.label}>DRAMA</Text>
        <Text style={[styles.value, { color }]}>{displayed}</Text>
      </View>
      <Animated.View style={[styles.trackWrap, glowStyle, { shadowColor: color }]}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle, { backgroundColor: color }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  meter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.panel,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  value: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  trackWrap: {
    borderRadius: radius.pill,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    width: "100%",
    borderRadius: radius.pill,
    transformOrigin: "left",
  },
});
