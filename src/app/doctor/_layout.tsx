import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { DoctorSessionProvider } from "@/lib/doctor-session";
import { colors, type } from "@/lib/theme";

/** The doctor navigation stack. Nothing here is shared with the patient stack. */
export default function DoctorLayout() {
  return (
    <DoctorSessionProvider>
      {/* The header is now the light surface, so the status bar goes dark. */}
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          // Flat surface header: DESIGN.md carries elevation with borders, not
          // a shadow that washes out in sunlight.
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.doctor,
          headerTitleStyle: { ...type.headlineMd, color: colors.text },
          headerShadowVisible: false,
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
        <Stack.Screen name="stock" options={{ title: "Facility stock" }} />
        <Stack.Screen name="dashboard" options={{ title: "Facility dashboard" }} />
        <Stack.Screen name="patient/[code]" options={{ title: "Patient record" }} />
      </Stack>
    </DoctorSessionProvider>
  );
}
