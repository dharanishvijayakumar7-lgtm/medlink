import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { Loading } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { colors } from "@/lib/theme";

/**
 * Entry point of the patient stack: send a returning patient straight to their
 * home screen, and anyone else to mobile number sign-in.
 */
export default function PatientEntry() {
  const router = useRouter();
  const { session, loading } = usePatientSession();
  const { t } = useT();

  useEffect(() => {
    if (loading) return;
    router.replace(session ? "/patient/home" : "/patient/sign-in");
  }, [loading, session, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Loading label={t("patient.opening")} />
    </View>
  );
}
