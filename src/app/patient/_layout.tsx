import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useT } from "@/lib/i18n";
import { PatientSessionProvider } from "@/lib/patient-session";
import { colors, type } from "@/lib/theme";

/** The patient navigation stack. Nothing here is shared with the doctor stack. */
export default function PatientLayout() {
  const { t } = useT();
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
        <Stack.Screen name="register" options={{ title: t("nav.patient.register") }} />
        <Stack.Screen
          name="home"
          options={{ title: t("nav.patient.home"), headerBackVisible: false }}
        />
        <Stack.Screen name="symptom-check" options={{ title: t("nav.patient.symptomCheck") }} />
        <Stack.Screen name="record" options={{ title: t("nav.patient.record") }} />
        {/* Records from other hospitals - kept apart from My Record on purpose. */}
        <Stack.Screen name="documents/index" options={{ title: t("nav.patient.documents") }} />
        <Stack.Screen name="documents/upload" options={{ title: t("nav.patient.upload") }} />
        <Stack.Screen name="documents/[id]" options={{ title: t("nav.patient.documentSummary") }} />
        {/* Calls to the voice agent, matched to the registered phone number. */}
        <Stack.Screen name="calls/index" options={{ title: t("nav.patient.calls") }} />
        <Stack.Screen name="calls/[id]" options={{ title: t("nav.patient.callSummary") }} />
        <Stack.Screen name="facilities" options={{ title: t("nav.patient.facilities") }} />
        <Stack.Screen name="sos" options={{ title: t("nav.patient.sos") }} />
      </Stack>
    </PatientSessionProvider>
  );
}
