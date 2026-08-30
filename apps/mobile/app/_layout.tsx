// Root navigation. Registers every screen so Wave-2 units (G: feed, H: analytics/devpost)
// only fill their own file. Pairing (index) is the entry; it redirects to feed once paired.
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: "#111" }, headerTintColor: "#fff" }}>
      <Stack.Screen name="index" options={{ title: "Pair", headerShown: false }} />
      <Stack.Screen name="feed" options={{ title: "Kibitzer" }} />
      <Stack.Screen name="analytics" options={{ title: "Analytics" }} />
      <Stack.Screen name="devpost" options={{ title: "Wrap-up" }} />
    </Stack>
  );
}
