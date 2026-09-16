import { useRouter } from "expo-router";

import { PhoneSignIn } from "@/components/phone-sign-in";
import { useDoctorSession } from "@/lib/doctor-session";
import { useT } from "@/lib/i18n";

/** Doctor sign-in: a known number opens the queue, a new one sets up a profile. */
export default function DoctorSignIn() {
  const router = useRouter();
  const { t } = useT();
  const { signIn } = useDoctorSession();

  return (
    <PhoneSignIn
      tone="doctor"
      title={t("signIn.doctorTitle")}
      subtitle={t("signIn.doctorSubtitle")}
      onResult={async (result) => {
        if (result.role === "patient") return t("signIn.numberIsPatient");
        if (result.role === "doctor" && result.doctor) {
          await signIn(result.doctor, result.phone);
          router.replace("/doctor");
          return null;
        }
        router.push({ pathname: "/doctor/setup", params: { phone: result.phone } });
        return null;
      }}
    />
  );
}
