import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { PatientSessionProvider } from "@/lib/patient-session";
import { colors } from "@/lib/theme";

/** The patient navigation stack. Nothing here is shared with the doctor stack. */
export default function PatientLayout() {
  return (
    <PatientSessionProvider>
      {/* The teal header sits under the status bar, so it needs light icons. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.patient },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: { fontWeight: "700" },
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
