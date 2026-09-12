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

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

// --- Types (mirrors app/schemas.py) -----------------------------------------

export type TriageStatus = "WAITING" | "IN_PROGRESS" | "DONE";
export type TriageSource = "app" | "voice_call";
export type ReferralStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "NO_SHOW";
export type StockItemType = "medicine" | "diagnostic";

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
  status: TriageStatus;
  source: TriageSource;
  created_at: string;
};

export type FacilitySummary = {
  id: number;
  name: string;
  type: string;
  area_label: string;
};

export type StockItem = {
  id: number;
  item_name: string;
  item_type: StockItemType;
  available: boolean;
  updated_at: string;
};

export type Facility = FacilitySummary & {
  stock: StockItem[];
};

export type Doctor = {
  id: number;
  name: string;
  specialization: string;
  created_at: string;
  facility: FacilitySummary | null;
};

export type ConsultationNote = {
  id: number;
  note_text: string;
  is_high_risk: boolean;
  high_risk_reason: string | null;
  created_at: string;
  doctor: Doctor;
  referred_to_facility: FacilitySummary | null;
};

export type Referral = {
  id: number;
  status: ReferralStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  to_facility: FacilitySummary;
  doctor: Doctor;
};

export type PatientRecord = Patient & {
  triage_entries: TriageEntry[];
  notes: ConsultationNote[];
  referrals: Referral[];
  queue_position: number | null;
};

export type QueueItem = {
  unique_code: string;
  name: string;
  age: number;
  gender: string;
  village: string;
  is_high_risk: boolean;
  high_risk_reason: string | null;
  latest_triage_id: number | null;
  latest_triage_summary: string | null;
  latest_triage_at: string | null;
  latest_triage_status: TriageStatus | null;
  latest_triage_source: TriageSource | null;
  triage_count: number;
  note_count: number;
};

export type Consultation = {
  id: number;
  room_name: string;
  token: string;
  livekit_url: string;
  status: string;
  created_at: string;
  patient_name: string;
  patient_unique_code: string;
  doctor_name: string;
};

// --- Endpoints ---------------------------------------------------------------

export type PatientDraft = Omit<Patient, "id" | "unique_code" | "created_at">;

const code = (value: string) => encodeURIComponent(value);

export const api = {
  // Patients
  createPatient: (draft: PatientDraft) => post<Patient>("/patients", draft),

  getPatientRecord: (unique: string) =>
    request<PatientRecord>(`/patients/${code(unique)}`),

  getPatientReferrals: (unique: string) =>
    request<Referral[]>(`/patients/${code(unique)}/referrals`),

  addTriageEntry: (
    unique: string,
    entry: { answers: TriageAnswer[]; summary?: string },
  ) => post<TriageEntry>(`/patients/${code(unique)}/triage`, entry),

  addConsultationNote: (
    unique: string,
    note: {
      doctor_id: number;
      note_text: string;
      is_high_risk: boolean;
      high_risk_reason?: string | null;
      referred_to_facility_id?: number | null;
    },
  ) => post<ConsultationNote>(`/patients/${code(unique)}/notes`, note),

  // Doctors
  createDoctor: (draft: {
    name: string;
    specialization: string;
    facility_id?: number | null;
  }) => post<Doctor>("/doctors", draft),

  // Queues
  getRecentQueue: () => request<QueueItem[]>("/triage/recent"),

  getHighRiskQueue: () => request<QueueItem[]>("/triage/high-risk"),

  updateTriageStatus: (entryId: number, status: TriageStatus) =>
    patch<TriageEntry>(`/triage/${entryId}/status`, { status }),

  // Facilities and stock
  getFacilities: () => request<Facility[]>("/facilities"),

  getFacilityStock: (facilityId: number) =>
    request<StockItem[]>(`/facilities/${facilityId}/stock`),

  updateStockItem: (facilityId: number, itemId: number, available: boolean) =>
    patch<StockItem>(`/facilities/${facilityId}/stock/${itemId}`, { available }),

  // Referrals
  createReferral: (draft: {
    patient_unique_code: string;
    doctor_id: number;
    to_facility_id: number;
    notes?: string | null;
  }) => post<Referral>("/referrals", draft),

  updateReferralStatus: (referralId: number, status: ReferralStatus) =>
    patch<Referral>(`/referrals/${referralId}/status`, { status }),

  // Teleconsultation
  startConsultation: (unique: string, doctorId: number) =>
    post<Consultation>(`/consultations/${code(unique)}/start`, {
      doctor_id: doctorId,
    }),

  // Resolves to null when no call is waiting, so it is cheap to poll.
  getPendingConsultation: (unique: string) =>
    request<Consultation | null>(`/consultations/pending/${code(unique)}`),

  endConsultation: (consultationId: number) =>
    post<Consultation>(`/consultations/${consultationId}/end`),
};
