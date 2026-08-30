// Unit 0 skeleton — registers every screen so Units F/G/H only fill their own file.
// Owned by Unit F (F may adjust nav chrome; screen FILES are owned per the ownership table).
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Pair" }} />
      <Stack.Screen name="feed" options={{ title: "Kibitzer" }} />
      <Stack.Screen name="analytics" options={{ title: "Analytics" }} />
      <Stack.Screen name="devpost" options={{ title: "Wrap-up" }} />
    </Stack>
  );
}
