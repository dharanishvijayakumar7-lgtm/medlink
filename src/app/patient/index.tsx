import { useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { Loading } from "@/components/ui";
import { usePatientSession } from "@/lib/patient-session";
import { colors } from "@/lib/theme";

/**
 * Entry point of the patient stack: send a returning patient straight to their
 * home screen, and a new one to identity capture.
 */
export default function PatientEntry() {
  const router = useRouter();
  const { session, loading } = usePatientSession();

  useEffect(() => {
    if (loading) return;
    router.replace(session ? "/patient/home" : "/patient/register");
  }, [loading, session, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Loading label="Opening MedLink..." />
    </View>
  );
}
