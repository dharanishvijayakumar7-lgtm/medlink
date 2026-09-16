import { useRouter } from "expo-router";

import { PhoneSignIn } from "@/components/phone-sign-in";
import { useDoctorSession } from "@/lib/doctor-session";
import { useT } from "@/lib/i18n";

/**
 * Doctor sign-in. A known number opens the queue; a new one goes on to the
 * details form. A patient's number is refused. The session is still
 * in-memory, so closing the app signs the doctor out.
 */
export default function DoctorSignIn() {
  const router = useRouter();
  const { t } = useT();
  const { setDoctor } = useDoctorSession();

  return (
    <PhoneSignIn
      tone="doctor"
      title={t("signIn.doctorTitle")}
      body={t("signIn.doctorBody")}
      onResult={(result) => {
        if (result.role === "patient") return t("signIn.numberIsPatient");
        if (result.doctor) {
          setDoctor(result.doctor);
          router.replace("/doctor/queue");
        } else {
          router.push({ pathname: "/doctor/setup", params: { phone: result.phone } });
        }
        return null;
      }}
    />
  );
}
