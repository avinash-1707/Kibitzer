// Shared press-feedback wrapper — every touchable button in the app (Scan,
// Connect, Wrap up, Play, Share, Retry, persona pills) scales down slightly
// on press, mirroring the web's `:active { transform: scale(0.97) }` rule.
// Frequency gate: buttons are pressed occasionally (not per-frame), so a
// short spring is welcome feedback rather than friction.
import { type ReactNode } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { duration } from "../theme";

const PRESSED_SCALE = 0.96;

export function ScalePressable({
  onPress,
  disabled,
  style,
  children,
  accessibilityRole,
  accessibilityLabel,
  onLayout,
}: {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  accessibilityRole?: "button";
  accessibilityLabel?: string;
  /** Forwarded to the outer wrapper — lets callers measure this button's
   *  position within a flex row (e.g. a sliding highlight pill). */
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View onLayout={onLayout} style={[animatedStyle, disabled && styles.disabled]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => {
          if (reduceMotion) return;
          scale.value = withTiming(PRESSED_SCALE, { duration: duration.fast });
        }}
        onPressOut={() => {
          if (reduceMotion) return;
          scale.value = withTiming(1, { duration: duration.base });
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
});
