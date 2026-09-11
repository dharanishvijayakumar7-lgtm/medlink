/**
 * Typed client for the MedLink FastAPI backend.
 *
 * The base URL is resolved from the Metro host the device already reached, so
 * a phone on the same Wi-Fi works with no configuration. Set
 * EXPO_PUBLIC_API_URL to override (for example when the API is not on :8000).
 */

import Constants from "expo-constants";

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const hostUri =
    Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? "";
  const host = hostUri.split(":")[0];
  return `http://${host || "localhost"}:8000`;
}

export const API_BASE_URL = resolveBaseUrl();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error(
      `Cannot reach the MedLink server at ${API_BASE_URL}. Check that it is running and on the same network.`,
    );
  }

  if (!response.ok) {
    throw new Error(await readError(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = body?.detail;
    if (typeof detail === "string") return detail;
    // FastAPI validation errors arrive as a list of field problems.
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((item: { loc?: string[]; msg?: string }) => {
          const field = item.loc?.[item.loc.length - 1];
          return field ? `${field}: ${item.msg}` : item.msg;
        })
        .join("\n");
    }
  } catch {
    // fall through to the generic message
  }
  return `Request failed (${response.status})`;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

// --- Types (mirrors app/schemas.py) -----------------------------------------

export type Patient = {
  id: number;
  unique_code: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  village: string;
  preferred_language: string;
  created_at: string;
};

export type TriageAnswer = { question: string; answer: string };

export type TriageEntry = {
  id: number;
  summary: string;
  answers: TriageAnswer[];
  created_at: string;
};

export type Doctor = {
  id: number;
  name: string;
  specialization: string;
  created_at: string;
};

export type Facility = {
  id: number;
  name: string;
  type: string;
  area_label: string;
};

export type ConsultationNote = {
  id: number;
  note_text: string;
  is_high_risk: boolean;
  high_risk_reason: string | null;
  created_at: string;
  doctor: Doctor;
  referred_to_facility: Facility | null;
};

export type PatientRecord = Patient & {
  triage_entries: TriageEntry[];
  notes: ConsultationNote[];
};

export type QueueItem = {
  unique_code: string;
  name: string;
  age: number;
  gender: string;
  village: string;
  is_high_risk: boolean;
  high_risk_reason: string | null;
  latest_triage_summary: string | null;
  latest_triage_at: string | null;
  triage_count: number;
  note_count: number;
};

// --- Endpoints ---------------------------------------------------------------

export type PatientDraft = Omit<Patient, "id" | "unique_code" | "created_at">;

export const api = {
  createPatient: (draft: PatientDraft) => post<Patient>("/patients", draft),

  getPatientRecord: (code: string) =>
    request<PatientRecord>(`/patients/${encodeURIComponent(code)}`),

  addTriageEntry: (
    code: string,
    entry: { answers: TriageAnswer[]; summary?: string },
  ) =>
    post<TriageEntry>(`/patients/${encodeURIComponent(code)}/triage`, entry),

  addConsultationNote: (
    code: string,
    note: {
      doctor_id: number;
      note_text: string;
      is_high_risk: boolean;
      high_risk_reason?: string | null;
      referred_to_facility_id?: number | null;
    },
  ) =>
    post<ConsultationNote>(`/patients/${encodeURIComponent(code)}/notes`, note),

  createDoctor: (draft: { name: string; specialization: string }) =>
    post<Doctor>("/doctors", draft),

  getRecentQueue: () => request<QueueItem[]>("/triage/recent"),

  getHighRiskQueue: () => request<QueueItem[]>("/triage/high-risk"),

  getFacilities: () => request<Facility[]>("/facilities"),
};
