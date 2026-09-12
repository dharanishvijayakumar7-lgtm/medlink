import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { PatientSessionProvider } from "@/lib/patient-session";
import { colors, type } from "@/lib/theme";

/** The patient navigation stack. Nothing here is shared with the doctor stack. */
export default function PatientLayout() {
  return (
    <PatientSessionProvider>
      {/* The header is now the light surface, so the status bar goes dark. */}
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          // Flat surface header: DESIGN.md carries elevation with borders, not
          // a shadow that washes out in sunlight.
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.patient,
          headerTitleStyle: { ...type.headlineMd, color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: "Your details" }} />
        <Stack.Screen
          name="home"
          options={{ title: "MedLink", headerBackVisible: false }}
        />
        <Stack.Screen name="symptom-check" options={{ title: "Symptom check" }} />
        <Stack.Screen name="record" options={{ title: "My record" }} />
        <Stack.Screen name="facilities" options={{ title: "Nearby facilities" }} />
        <Stack.Screen name="sos" options={{ title: "Emergency SOS" }} />
      </Stack>
    </PatientSessionProvider>
  );
}
