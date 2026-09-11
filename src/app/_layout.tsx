import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

/**
 * Root stack. It holds exactly three entries: the role select screen and the
 * two role stacks. Patient and Doctor never share a screen below this point.
 */
export default function RootLayout() {
  return (
    <>
      {/* Role select has a light background; each role stack sets its own. */}
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="patient" />
        <Stack.Screen name="doctor" />
      </Stack>
    </>
  );
}
