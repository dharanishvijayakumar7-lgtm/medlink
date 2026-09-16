import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { DoctorSessionProvider } from "@/lib/doctor-session";
import { useT } from "@/lib/i18n";
import { colors, type } from "@/lib/theme";

/** The doctor navigation stack. Nothing here is shared with the patient stack. */
export default function DoctorLayout() {
  const { t } = useT();
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
        <Stack.Screen name="index" options={{ title: t("nav.doctor.home") }} />
        <Stack.Screen name="setup" options={{ title: t("nav.doctor.home") }} />
        <Stack.Screen
          name="queue"
          options={{ title: t("nav.doctor.queue"), headerBackVisible: false }}
        />
        <Stack.Screen name="high-risk" options={{ title: t("nav.doctor.highRisk") }} />
        <Stack.Screen name="search" options={{ title: t("nav.doctor.search") }} />
        <Stack.Screen name="stock" options={{ title: t("nav.doctor.stock") }} />
        <Stack.Screen name="dashboard" options={{ title: t("nav.doctor.dashboard") }} />
        <Stack.Screen name="patient/[code]" options={{ title: t("nav.doctor.patient") }} />
      </Stack>
    </DoctorSessionProvider>
  );
}
