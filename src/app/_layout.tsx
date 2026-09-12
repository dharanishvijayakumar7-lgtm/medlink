import { registerGlobals } from "@livekit/react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

// LiveKit needs the WebRTC globals installed before any room is created. This
// is the first module expo-router loads, so it is the right place for it.
registerGlobals();

/**
 * Root stack. Role select, the two role stacks, and the call screen that both
 * flows share. Patient and Doctor never share a screen below this point.
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
        <Stack.Screen
          name="call"
          options={{ presentation: "fullScreenModal", gestureEnabled: false }}
        />
      </Stack>
    </>
  );
}
