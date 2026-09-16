import { Redirect } from "expo-router";

import { usePatientSession } from "@/lib/patient-session";

/**
 * Entry point of the patient stack, and where the sign-in guards send people.
 * Signed in: home. Just switched family member: the profile list for the same
 * number. Otherwise: mobile number sign-in.
 */
export default function PatientEntry() {
  const { session, phone } = usePatientSession();

  if (session) return <Redirect href="/patient/home" />;
  if (phone) {
    return <Redirect href={{ pathname: "/patient/profiles", params: { phone } }} />;
  }
  return <Redirect href="/patient/sign-in" />;
}
