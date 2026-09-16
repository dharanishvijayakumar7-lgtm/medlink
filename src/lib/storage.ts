/** Local persistence of who is signed in, so reopening the app skips sign-in. */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Doctor } from "@/lib/api";

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

// --- Last signed-in patient number --------------------------------------------
//
// Kept when a patient switches to another family member on the same phone, so
// the app can go straight to "Who is using MedLink?". Cleared on sign out.

const PATIENT_PHONE_KEY = "medlink.patient.phone";

export async function loadPatientPhone(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PATIENT_PHONE_KEY);
  } catch {
    return null;
  }
}

export async function savePatientPhone(phone: string): Promise<void> {
  await AsyncStorage.setItem(PATIENT_PHONE_KEY, phone);
}

export async function clearPatientPhone(): Promise<void> {
  await AsyncStorage.removeItem(PATIENT_PHONE_KEY);
}

// --- Doctor session -------------------------------------------------------------
//
// The last known profile is kept too, so a doctor stays signed in when the
// server cannot be reached at launch.

const DOCTOR_KEY = "medlink.doctor.session";

export type DoctorSession = { phone: string; doctor: Doctor };

export async function loadDoctorSession(): Promise<DoctorSession | null> {
  try {
    const raw = await AsyncStorage.getItem(DOCTOR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DoctorSession>;
    if (!parsed.phone || !parsed.doctor?.id) return null;
    return { phone: parsed.phone, doctor: parsed.doctor };
  } catch {
    return null;
  }
}

export async function saveDoctorSession(session: DoctorSession): Promise<void> {
  await AsyncStorage.setItem(DOCTOR_KEY, JSON.stringify(session));
}

export async function clearDoctorSession(): Promise<void> {
  await AsyncStorage.removeItem(DOCTOR_KEY);
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

// --- App language ------------------------------------------------------------
//
// Chosen on the role select screen, before any role or patient exists, so it
// belongs to the device rather than to a patient.

const LANGUAGE_KEY = "medlink.language";

export async function loadLanguage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

export async function saveLanguage(code: string): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, code);
}
