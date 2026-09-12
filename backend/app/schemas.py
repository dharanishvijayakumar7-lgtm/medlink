"""Request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import ReferralStatus, StockItemType, TriageSource, TriageStatus

ORM = ConfigDict(from_attributes=True)


# --- Facilities -------------------------------------------------------------


class FacilitySummary(BaseModel):
    """Facility without its stock, for nesting inside other records."""

    model_config = ORM

    id: int
    name: str
    type: str
    area_label: str


class StockItemOut(BaseModel):
    model_config = ORM

    id: int
    item_name: str
    item_type: StockItemType
    available: bool
    updated_at: datetime


class StockItemUpdate(BaseModel):
    available: bool


class FacilityOut(FacilitySummary):
    """Facility with its stock, so the patient sees it before travelling."""

    stock: list[StockItemOut]


# --- Doctors ----------------------------------------------------------------


class DoctorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    specialization: str = Field(min_length=1, max_length=120)
    # The facility whose stock this doctor maintains.
    facility_id: int | None = None


class DoctorOut(BaseModel):
    model_config = ORM

    id: int
    name: str
    specialization: str
    created_at: datetime
    facility: FacilitySummary | None = None


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
    status: TriageStatus
    source: TriageSource
    created_at: datetime


class TriageStatusUpdate(BaseModel):
    status: TriageStatus


class TriageByPhoneCreate(BaseModel):
    """Posted by the voice agent when a phone triage ends.

    The caller is matched on phone number alone - that is the identity decision
    this endpoint exists to wire up. Demographics are only used when no patient
    with that number exists yet.
    """

    phone: str = Field(min_length=4, max_length=20)
    answers: list[TriageAnswer] = Field(default_factory=list)
    summary: str | None = None

    name: str | None = None
    age: int | None = Field(default=None, ge=0, le=120)
    gender: str | None = None
    village: str | None = None
    preferred_language: str | None = None

    @model_validator(mode="after")
    def require_some_content(self) -> "TriageByPhoneCreate":
        if not self.summary and not self.answers:
            raise ValueError("Provide a summary, answers, or both.")
        return self


class TriageByPhoneResult(BaseModel):
    """Tells the voice agent which record it landed on."""

    patient: "PatientOut"
    entry: TriageEntryOut
    # True when this call created the patient rather than matching one.
    created_patient: bool


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
    referred_to_facility: FacilitySummary | None


# --- Referrals --------------------------------------------------------------


class ReferralCreate(BaseModel):
    patient_unique_code: str
    doctor_id: int
    to_facility_id: int
    notes: str | None = None


class ReferralStatusUpdate(BaseModel):
    status: ReferralStatus


class ReferralOut(BaseModel):
    model_config = ORM

    id: int
    status: ReferralStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime
    to_facility: FacilitySummary
    doctor: DoctorOut


# --- Teleconsultation -------------------------------------------------------


class ConsultationStart(BaseModel):
    doctor_id: int


class ConsultationOut(BaseModel):
    """A room plus a join token minted for whoever asked for it."""

    id: int
    room_name: str
    token: str
    livekit_url: str
    status: str
    created_at: datetime
    patient_name: str
    patient_unique_code: str
    doctor_name: str


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
    """Full record: demographics, triage history, notes and referrals."""

    triage_entries: list[TriageEntryOut]
    notes: list[ConsultationNoteOut]
    referrals: list[ReferralOut]
    # 1-based place in the WAITING queue, or None when nothing is waiting.
    queue_position: int | None = None


# --- Doctor queue -----------------------------------------------------------


class QueueItem(BaseModel):
    unique_code: str
    name: str
    age: int
    gender: str
    village: str
    is_high_risk: bool
    high_risk_reason: str | None
    latest_triage_id: int | None
    latest_triage_summary: str | None
    latest_triage_at: datetime | None
    latest_triage_status: TriageStatus | None
    latest_triage_source: TriageSource | None
    triage_count: int
    note_count: int


TriageByPhoneResult.model_rebuild()
