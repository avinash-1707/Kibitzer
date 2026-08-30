// Branded loading placeholder — a soft breathing shimmer on a panel-2 block,
// shaped like the real content it stands in for (Analytics cards/panels,
// Devpost's generating state). Mirrors the web's `.skel` shimmer-sweep but
// uses an opacity loop (no gradient dependency) — still reads as "alive,
// working" rather than a flat gray box. Functional loading feedback, so it
// stays animated (slowed) under reduced motion rather than disappearing.
import { useEffect } from "react";
import type { DimensionValue } from "react-native";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors, radius } from "../theme";

export function Skeleton({
  width,
  height,
  radius: r = radius.xs,
}: {
  width: DimensionValue;
  height: number;
  radius?: number;
}) {
  const opacity = useSharedValue(0.5);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const cycle = reduceMotion ? 1600 : 900;
    // reverse=true bounces back down each cycle — one smooth breathing loop.
    opacity.value = withRepeat(withTiming(0.85, { duration: cycle }), -1, true);
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.base,
        style,
        { width, height, borderRadius: r },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.panel2 },
});
