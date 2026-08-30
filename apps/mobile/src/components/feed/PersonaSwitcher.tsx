// Persona control (mobile-app.md §Feed / §Session controls). PUT <base>/persona
// affects FUTURE narration only. The server broadcasts a `persona` frame which the
// store applies as the source of truth; local `pending` is just an optimistic echo.
// A sliding pill highlights the active persona (mirrors the web's layoutId pill).
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { PersonaKey } from "@kibitzer/shared";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { setPersona as putPersona } from "../../api";
import { ScalePressable } from "../ScalePressable";
import { colors, radius, spacing } from "../../theme";

const PERSONAS: PersonaKey[] = ["sports", "nature"];

export function PersonaSwitcher({
  base,
  active,
}: {
  base: string;
  active: PersonaKey | null;
}) {
  const [pending, setPending] = useState<PersonaKey | null>(null);
  const current = pending ?? active;
  const reduceMotion = useReducedMotion();

  const [layouts, setLayouts] = useState<Partial<Record<PersonaKey, { x: number; width: number }>>>({});
  const pillX = useSharedValue(0);
  const pillWidth = useSharedValue(0);
  const pillOpacity = useSharedValue(0);

  const activeLayout = current ? layouts[current] : undefined;
  useEffect(() => {
    if (!activeLayout) return;
    const move = reduceMotion
      ? (v: number) => withTiming(v, { duration: 0 })
      : (v: number) => withSpring(v, { stiffness: 260, damping: 26, mass: 0.7 });
    pillX.value = move(activeLayout.x);
    pillWidth.value = move(activeLayout.width);
    pillOpacity.value = withTiming(1, { duration: 120 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayout?.x, activeLayout?.width, reduceMotion]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillWidth.value,
    opacity: pillOpacity.value,
  }));

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      <Animated.View style={[styles.pill, pillStyle]} />
      {PERSONAS.map((p) => {
        const isActive = current === p;
        return (
          <ScalePressable
            key={p}
            style={styles.btn}
            disabled={pending !== null}
            onPress={() => {
              setPending(p);
              putPersona(base, p).finally(() => setPending(null));
            }}
            accessibilityRole="button"
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setLayouts((prev) => ({ ...prev, [p]: { x, width } }));
            }}
          >
            <Text style={[styles.text, isActive && styles.textActive]}>{p}</Text>
          </ScalePressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 3,
  },
  pill: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 0,
    backgroundColor: colors.panel3,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radius.md - 3,
  },
  btn: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md - 3,
  },
  text: { color: colors.muted, fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  textActive: { color: colors.text },
});
