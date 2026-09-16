import { useRouter } from "expo-router";

import { PhoneSignIn } from "@/components/phone-sign-in";
import { useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";

/** Patient sign-in: a mobile number, then a family member or registration. */
export default function PatientSignIn() {
  const router = useRouter();
  const { t } = useT();
  const { phone } = usePatientSession();

  return (
    <PhoneSignIn
      tone="patient"
      title={t("signIn.patientTitle")}
      subtitle={t("signIn.patientSubtitle")}
      initialPhone={phone}
      onResult={(result) => {
        if (result.role === "doctor") return t("signIn.numberIsDoctor");
        if (result.patients.length === 0) {
          router.push({ pathname: "/patient/register", params: { phone: result.phone } });
        } else {
          router.push({ pathname: "/patient/profiles", params: { phone: result.phone } });
        }
        return null;
      }}
    />
  );
}
