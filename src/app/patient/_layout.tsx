import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { BackToWelcome, stackScreenOptions } from "@/components/navigation";
import { Loading } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { PatientSessionProvider, usePatientSession } from "@/lib/patient-session";
import { colors } from "@/lib/theme";

/**
 * The patient navigation stack. Nothing here is shared with the doctor stack.
 *
 * Signed out: sign in with a mobile number, pick a family member, register.
 * Signed in: the tabs, and the screens that open on top of them. The guards
 * send anyone on the wrong side back to `index`, which routes them onward.
 */
function PatientStack() {
  const { t } = useT();
  const { session, loading } = usePatientSession();

  if (loading) return <Loading />;
  const signedIn = session !== null;
  const back = () => <BackToWelcome tint={colors.patient} />;

  return (
    <Stack screenOptions={stackScreenOptions("patient")}>
      <Stack.Screen name="index" options={{ headerShown: false }} />

      <Stack.Protected guard={!signedIn}>
        <Stack.Screen
          name="sign-in"
          options={{ title: t("nav.patient.signIn"), headerLeft: back }}
        />
        <Stack.Screen
          name="profiles"
          options={{ title: t("nav.patient.profiles"), headerLeft: back }}
        />
        <Stack.Screen name="register" options={{ title: t("nav.patient.register") }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="symptom-check" options={{ title: t("nav.patient.symptomCheck") }} />
        <Stack.Screen name="record" options={{ title: t("nav.patient.record") }} />
        {/* Records from other hospitals - kept apart from My Record on purpose. */}
        <Stack.Screen name="documents/index" options={{ title: t("nav.patient.documents") }} />
        <Stack.Screen name="documents/upload" options={{ title: t("nav.patient.upload") }} />
        <Stack.Screen
          name="documents/[id]"
          options={{ title: t("nav.patient.documentSummary") }}
        />
        {/* Calls to the voice agent, matched to the registered phone number. */}
        <Stack.Screen name="calls/index" options={{ title: t("nav.patient.calls") }} />
        <Stack.Screen name="calls/[id]" options={{ title: t("nav.patient.callSummary") }} />
        <Stack.Screen name="sos" options={{ title: t("nav.patient.sos") }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function PatientLayout() {
  return (
    <PatientSessionProvider>
      <StatusBar style="dark" />
      <PatientStack />
    </PatientSessionProvider>
  );
}
