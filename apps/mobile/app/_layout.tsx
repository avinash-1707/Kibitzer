// Root navigation. Registers every screen so Wave-2 units (G: feed, H: analytics/devpost)
// only fill their own file. Pairing (index) is the entry; it redirects to feed once paired.
// Also owns the app's two global concerns: loading the display font (gate render on it,
// same pattern as any other loader) and the reduced-motion policy for every reanimated
// layout animation in the tree.
import { useFonts } from "expo-font";
import {
  Unbounded_600SemiBold,
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
} from "@expo-google-fonts/unbounded";
import { Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ReduceMotion, ReducedMotionConfig } from "react-native-reanimated";
import { colors, fonts } from "../src/theme";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    [fonts.displaySemibold]: Unbounded_600SemiBold,
    [fonts.displayBold]: Unbounded_700Bold,
    [fonts.displayExtraBold]: Unbounded_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      {/* Every FadeIn/FadeInDown/LinearTransition etc. in the tree defers to the
          OS "reduce motion" setting instead of always animating. */}
      <ReducedMotionConfig mode={ReduceMotion.System} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.panel },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text, fontFamily: fonts.displaySemibold, fontSize: 15 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Pair", headerShown: false }} />
        <Stack.Screen name="feed" options={{ title: "Kibitzer" }} />
        <Stack.Screen name="analytics" options={{ title: "Analytics" }} />
        <Stack.Screen name="devpost" options={{ title: "Wrap-up" }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
});
