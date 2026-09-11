import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { DoctorSessionProvider } from "@/lib/doctor-session";
import { colors } from "@/lib/theme";

/** The doctor navigation stack. Nothing here is shared with the patient stack. */
export default function DoctorLayout() {
  return (
    <DoctorSessionProvider>
      {/* The indigo header sits under the status bar, so it needs light icons. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.doctor },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Doctor" }} />
        <Stack.Screen
          name="queue"
          options={{ title: "Patient queue", headerBackVisible: false }}
        />
        <Stack.Screen name="high-risk" options={{ title: "High-risk worklist" }} />
        <Stack.Screen name="search" options={{ title: "Search patient" }} />
        <Stack.Screen name="patient/[code]" options={{ title: "Patient record" }} />
      </Stack>
    </DoctorSessionProvider>
  );
}
