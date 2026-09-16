import { useRouter } from "expo-router";

import { PhoneSignIn } from "@/components/phone-sign-in";
import { useT } from "@/lib/i18n";

/**
 * Patient sign-in. A number with patients on it opens the family profile list;
 * a new number goes to registration. A doctor's number is refused.
 */
export default function PatientSignIn() {
  const router = useRouter();
  const { t } = useT();

  return (
    <PhoneSignIn
      tone="patient"
      title={t("signIn.patientTitle")}
      body={t("signIn.patientBody")}
      onResult={(result) => {
        if (result.role === "doctor") return t("signIn.numberIsDoctor");
        router.push({
          pathname: result.patients.length > 0 ? "/patient/profiles" : "/patient/register",
          params: { phone: result.phone },
        });
        return null;
      }}
    />
  );
}
