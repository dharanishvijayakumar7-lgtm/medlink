import { Redirect } from "expo-router";

import { useDoctorSession } from "@/lib/doctor-session";

/** Entry point of the doctor stack, and where the sign-in guards send people. */
export default function DoctorEntry() {
  const { doctor } = useDoctorSession();
  return <Redirect href={doctor ? "/doctor/queue" : "/doctor/sign-in"} />;
}
