import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { BackToWelcome, stackScreenOptions } from "@/components/navigation";
import { Loading } from "@/components/ui";
import { DoctorSessionProvider, useDoctorSession } from "@/lib/doctor-session";
import { useT } from "@/lib/i18n";
import { colors } from "@/lib/theme";

/**
 * The doctor navigation stack. Nothing here is shared with the patient stack.
 *
 * Signed out: mobile number sign-in, then profile setup for a new number.
 * Signed in: the tabs, and the screens that open on top of them.
 */
function DoctorStack() {
  const { t } = useT();
  const { doctor, loading } = useDoctorSession();

  if (loading) return <Loading />;
  const signedIn = doctor !== null;
  const back = () => <BackToWelcome tint={colors.doctor} />;

  return (
    <Stack screenOptions={stackScreenOptions("doctor")}>
      <Stack.Screen name="index" options={{ headerShown: false }} />

      <Stack.Protected guard={!signedIn}>
        <Stack.Screen
          name="sign-in"
          options={{ title: t("nav.doctor.signIn"), headerLeft: back }}
        />
        <Stack.Screen name="setup" options={{ title: t("nav.doctor.setup") }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="stock" options={{ title: t("nav.doctor.stock") }} />
        <Stack.Screen name="dashboard" options={{ title: t("nav.doctor.dashboard") }} />
        <Stack.Screen name="patient/[code]" options={{ title: t("nav.doctor.patient") }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function DoctorLayout() {
  return (
    <DoctorSessionProvider>
      <StatusBar style="dark" />
      <DoctorStack />
    </DoctorSessionProvider>
  );
}
