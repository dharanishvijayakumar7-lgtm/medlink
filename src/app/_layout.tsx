import {
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  NotoSans_700Bold,
  useFonts,
} from "@expo-google-fonts/noto-sans";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { colors } from "@/lib/theme";

// Installs LiveKit's WebRTC globals, or records that this build has none (Expo
// Go). Importing @livekit/react-native directly here would throw at module
// scope and take every route down with it - see @/lib/livekit.
import "@/lib/livekit";

// Hold the splash until Noto Sans is ready, so no screen flashes in a fallback
// face. Devanagari and the other Indic scripts need the real font.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Root stack. Role select, the two role stacks, and the call screen that both
 * flows share. Patient and Doctor never share a screen below this point.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
  });

  useEffect(() => {
    // Carry on even if the font failed: a system face beats a blank screen.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    // Needed by the gesture-handler Pressable the doctor queue uses.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Role select has a light background; each role stack sets its own. */}
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="patient" />
        <Stack.Screen name="doctor" />
        <Stack.Screen
          name="call"
          options={{ presentation: "fullScreenModal", gestureEnabled: false }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
