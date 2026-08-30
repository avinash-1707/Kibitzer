// "Standby" broadcast-console glyph — a slow expanding ring around a static
// amber dot, like a signal waiting to be picked up. Mirrors the web's
// `.standby-ring`. Reserved for screen-level empty states (Feed/Analytics
// pre-session), a single hero appearance rather than decorative noise.
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../theme";

function Ring({ delay }: { delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2400 }), -1, false),
    );
  }, [progress, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.7 + progress.value * 1.2 }],
    opacity: 0.7 * (1 - progress.value),
  }));

  return <Animated.View style={[styles.ring, style]} />;
}

export function StandbyDot() {
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.wrap}>
      {!reduceMotion && (
        <>
          <Ring delay={0} />
          <Ring delay={1200} />
        </>
      )}
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
