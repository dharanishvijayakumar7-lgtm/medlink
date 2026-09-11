"""Request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

ORM = ConfigDict(from_attributes=True)


# --- Facilities -------------------------------------------------------------


class FacilityOut(BaseModel):
    model_config = ORM

    id: int
    name: str
    type: str
    area_label: str


# --- Doctors ----------------------------------------------------------------


class DoctorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    specialization: str = Field(min_length=1, max_length=120)


class DoctorOut(BaseModel):
    model_config = ORM

    id: int
    name: str
    specialization: str
    created_at: datetime


# --- Triage -----------------------------------------------------------------


class TriageAnswer(BaseModel):
    question: str
    answer: str


class TriageEntryCreate(BaseModel):
    answers: list[TriageAnswer] = Field(min_length=1)
    # Derived from the answers when the client does not send one.
    summary: str | None = None


class TriageEntryOut(BaseModel):
    model_config = ORM

    id: int
    summary: str
    answers: list[TriageAnswer]
    created_at: datetime


# --- Consultation notes -----------------------------------------------------


class ConsultationNoteCreate(BaseModel):
    doctor_id: int
    note_text: str = Field(min_length=1)
    is_high_risk: bool = False
    high_risk_reason: str | None = None
    referred_to_facility_id: int | None = None


class ConsultationNoteOut(BaseModel):
    model_config = ORM

    id: int
    note_text: str
    is_high_risk: bool
    high_risk_reason: str | None
    created_at: datetime
    doctor: DoctorOut
    referred_to_facility: FacilityOut | None


# --- Patients ---------------------------------------------------------------


class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    age: int = Field(ge=0, le=120)
    gender: str = Field(min_length=1, max_length=20)
    phone: str = Field(min_length=4, max_length=20)
    village: str = Field(min_length=1, max_length=120)
    preferred_language: str = Field(min_length=1, max_length=40)


class PatientOut(BaseModel):
    model_config = ORM

    id: int
    unique_code: str
    name: str
    age: int
    gender: str
    phone: str
    village: str
    preferred_language: str
    created_at: datetime


class PatientRecord(PatientOut):
    """Full record: demographics + triage history + every doctor note."""

    triage_entries: list[TriageEntryOut]
    notes: list[ConsultationNoteOut]


# --- Doctor queue -----------------------------------------------------------


class QueueItem(BaseModel):
    unique_code: str
    name: str
    age: int
    gender: str
    village: str
    is_high_risk: bool
    high_risk_reason: str | None
    latest_triage_summary: str | None
    latest_triage_at: datetime | None
    triage_count: int
    note_count: int
