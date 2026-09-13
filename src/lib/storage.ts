/** Local persistence of the patient session, so reopening the app skips registration. */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "medlink.patient.session";

export type PatientSession = {
  unique_code: string;
  phone: string;
};

export async function loadPatientSession(): Promise<PatientSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PatientSession>;
    if (!parsed.unique_code || !parsed.phone) return null;
    return { unique_code: parsed.unique_code, phone: parsed.phone };
  } catch {
    return null;
  }
}

export async function savePatientSession(session: PatientSession): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearPatientSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

// --- One-time date of birth prompt -------------------------------------------
//
// Patients registered before date of birth existed are asked for it once. If
// they skip, the prompt never nags again; they can still add it from Home.

const DOB_PROMPT_KEY = "medlink.dobPromptDismissed.";

export async function isDobPromptDismissed(uniqueCode: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DOB_PROMPT_KEY + uniqueCode)) === "1";
  } catch {
    return false;
  }
}

export async function dismissDobPrompt(uniqueCode: string): Promise<void> {
  await AsyncStorage.setItem(DOB_PROMPT_KEY + uniqueCode, "1");
}
