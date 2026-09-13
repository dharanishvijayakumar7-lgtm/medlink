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
    // JSON bodies are sent as strings. A FormData upload must not get this
    // header: fetch has to set multipart/form-data itself, with its boundary.
    const isJson = typeof init?.body === "string";
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(isJson ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
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

function patch_<T>(path: string, body: unknown): Promise<T> {
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
  /** ISO date. Null for patients registered before it was collected. */
  date_of_birth: string | null;
  /** Computed by the server from date_of_birth at request time; never stored. */
  age: number | null;
  /** "34 yrs", "1 yr 3 mo", "7 mo" - null when there is no date of birth. */
  age_label: string | null;
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
  /** ISO date (YYYY-MM-DD), or null when no check-in is scheduled. */
  follow_up_due_date: string | null;
  follow_up_resolved: boolean;
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
  age: number | null;
  age_label: string | null;
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

export type FollowUpItem = {
  note_id: number;
  unique_code: string;
  name: string;
  age: number | null;
  age_label: string | null;
  gender: string;
  village: string;
  phone: string;
  follow_up_due_date: string;
  /** 0 on the day it falls due, growing after that. */
  days_overdue: number;
  is_high_risk: boolean;
  high_risk_reason: string | null;
  note_text: string;
  doctor_name: string;
  created_at: string;
};

/** `rate` is null when nothing was due - show "nothing yet", not 0%. */
export type RateStat = {
  completed: number;
  total: number;
  rate: number | null;
};

export type PatientLoad = {
  value: number;
  is_proxy: boolean;
  basis: string;
  referred_patients: number;
  seen_by_facility_doctors: number;
  stock_updates: number;
};

export type FacilityDashboard = {
  facility: FacilitySummary;
  window_days: number;
  from_date: string;
  to_date: string;
  patient_load: PatientLoad;
  referral_completion_rate: RateStat;
  follow_up_completion_rate: RateStat;
};

export type DocumentStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export type Medication = { name: string; details: string | null };

export type LabFinding = {
  test: string;
  value: string | null;
  plain_explanation: string;
};

export type KeyTerm = { term: string; explanation: string };

/** What Gemini read from an uploaded record, in plain language. */
export type ExtractedSummary = {
  is_medical_document: boolean;
  hospital_name: string | null;
  visit_date: string | null;
  /** Raw text from the document - context only, never the displayed age. */
  patient_age_mentioned: string | null;
  symptoms: string[];
  medications: Medication[];
  deficiencies: LabFinding[];
  excesses: LabFinding[];
  key_terms: KeyTerm[];
  plain_summary: string;
  suggested_next_steps: string;
};

export type MedicalDocument = {
  id: number;
  hospital_name: string | null;
  visit_date: string | null;
  hospital_name_entered: boolean;
  visit_date_entered: boolean;
  original_filename: string;
  file_size: number;
  uploaded_at: string;
  status: DocumentStatus;
  failure_reason: string | null;
  processed_at: string | null;
  extracted_summary: ExtractedSummary | null;
  /** Relative path; resolve with documentFileUrl(). */
  file_url: string;
  /** Sent with every document so no screen can show a summary without it. */
  disclaimer: string;
};

export type TimelineKind = "document" | "triage" | "note" | "referral";

export type TimelineEntry = {
  kind: TimelineKind;
  date: string;
  /** A document with no known visit date, placed by its upload date. */
  date_is_estimated: boolean;
  /** Hospital name, or "MedLink" for native events. */
  source: string;
  title: string;
  /** Computed from date of birth for this entry's date. */
  age_at_date: number | null;
  age_at_date_label: string | null;
  document: MedicalDocument | null;
  triage: TriageEntry | null;
  note: ConsultationNote | null;
  referral: Referral | null;
};

export type PatientTimeline = {
  patient: Patient;
  /** Oldest first. */
  entries: TimelineEntry[];
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

/** Registration payload. Age is never sent - the server derives it. */
export type PatientDraft = {
  name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  village: string;
  preferred_language: string;
};

/** A PDF chosen with expo-document-picker. */
export type PickedPdf = { uri: string; name: string; mimeType?: string | null };

const code = (value: string) => encodeURIComponent(value);

export const api = {
  // Patients
  createPatient: (draft: PatientDraft) => post<Patient>("/patients", draft),

  getPatientRecord: (unique: string) =>
    request<PatientRecord>(`/patients/${code(unique)}`),

  /** Fill in a date of birth for a patient registered before it existed. */
  updatePatient: (unique: string, changes: { date_of_birth: string }) =>
    patch_<Patient>(`/patients/${code(unique)}`, changes),

  /** Merged uploaded records + MedLink history, oldest first. */
  getTimeline: (unique: string) =>
    request<PatientTimeline>(`/patients/${code(unique)}/timeline`),

  // Uploaded medical records
  /**
   * Returns as soon as the file is stored, with status PENDING. Extraction
   * runs on the server afterwards; poll getDocument until DONE or FAILED.
   */
  uploadDocument: (
    unique: string,
    file: PickedPdf,
    extras: { hospital_name?: string; visit_date?: string },
  ) => {
    const form = new FormData();
    // React Native's FormData takes a { uri, name, type } descriptor for files.
    form.append("file", {
      uri: file.uri,
      name: file.name || "document.pdf",
      type: file.mimeType || "application/pdf",
    } as unknown as Blob);
    if (extras.hospital_name?.trim()) {
      form.append("hospital_name", extras.hospital_name.trim());
    }
    if (extras.visit_date?.trim()) form.append("visit_date", extras.visit_date.trim());
    return request<MedicalDocument>(`/patients/${code(unique)}/documents`, {
      method: "POST",
      body: form,
    });
  },

  listDocuments: (unique: string) =>
    request<MedicalDocument[]>(`/patients/${code(unique)}/documents`),

  getDocument: (documentId: number) =>
    request<MedicalDocument>(`/documents/${documentId}`),

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
      follow_up_due_date?: string | null;
    },
  ) => post<ConsultationNote>(`/patients/${code(unique)}/notes`, note),

  /**
   * Reschedule or close a follow-up. Pass follow_up_due_date: null to clear it;
   * omit the key entirely to leave it untouched.
   */
  updateFollowUp: (
    noteId: number,
    patch: { follow_up_due_date?: string | null; follow_up_resolved?: boolean },
  ) => patch_<ConsultationNote>(`/notes/${noteId}/follow-up`, patch),

  // Doctors
  createDoctor: (draft: {
    name: string;
    specialization: string;
    facility_id?: number | null;
  }) => post<Doctor>("/doctors", draft),

  // Queues
  getRecentQueue: () => request<QueueItem[]>("/triage/recent"),

  getHighRiskQueue: () => request<QueueItem[]>("/triage/high-risk"),

  getFollowUpsDue: () => request<FollowUpItem[]>("/triage/follow-ups-due"),

  updateTriageStatus: (entryId: number, status: TriageStatus) =>
    patch_<TriageEntry>(`/triage/${entryId}/status`, { status }),

  // Facilities and stock
  getFacilities: () => request<Facility[]>("/facilities"),

  getFacilityDashboard: (facilityId: number, days: number) =>
    request<FacilityDashboard>(
      `/facilities/${facilityId}/dashboard?days=${days}`,
    ),

  getFacilityStock: (facilityId: number) =>
    request<StockItem[]>(`/facilities/${facilityId}/stock`),

  updateStockItem: (facilityId: number, itemId: number, available: boolean) =>
    patch_<StockItem>(`/facilities/${facilityId}/stock/${itemId}`, { available }),

  // Referrals
  createReferral: (draft: {
    patient_unique_code: string;
    doctor_id: number;
    to_facility_id: number;
    notes?: string | null;
  }) => post<Referral>("/referrals", draft),

  updateReferralStatus: (referralId: number, status: ReferralStatus) =>
    patch_<Referral>(`/referrals/${referralId}/status`, { status }),

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

/** Absolute URL for a document's original PDF, for opening on the device. */
export function documentFileUrl(document: Pick<MedicalDocument, "file_url">): string {
  return `${API_BASE_URL}${document.file_url}`;
}

/** Still being read on the server - the screen should keep polling. */
export function isDocumentInFlight(document: Pick<MedicalDocument, "status">): boolean {
  return document.status === "PENDING" || document.status === "PROCESSING";
}
