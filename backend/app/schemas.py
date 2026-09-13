"""Request/response schemas."""

from datetime import date, datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
    model_validator,
)

from app.ages import age_on, today
from app.extraction import ExtractedSummary
from app.models import (
    DocumentStatus,
    ReferralStatus,
    StockItemType,
    TriageSource,
    TriageStatus,
)

ORM = ConfigDict(from_attributes=True)

# Anything earlier is a typing slip, not a patient.
EARLIEST_BIRTH_DATE = date(1900, 1, 1)


def check_date_of_birth(value: date | None) -> date | None:
    """Shared rule for every place a date of birth enters the system."""
    if value is None:
        return value
    if value > today():
        raise ValueError("date_of_birth cannot be in the future")
    if value < EARLIEST_BIRTH_DATE:
        raise ValueError("date_of_birth must be on or after 1900-01-01")
    return value


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


# --- Facility dashboard -----------------------------------------------------


class RateStat(BaseModel):
    """A completion rate over a window.

    ``rate`` is null rather than 0.0 when nothing was due, so the dashboard can
    say "nothing due yet" instead of showing a misleading 0%.
    """

    completed: int
    total: int
    rate: float | None


class PatientLoad(BaseModel):
    """How busy a facility has been.

    ``is_proxy`` is true because triage entries are not facility-linked: a
    symptom check records the patient, not where they were seen. Until that
    link exists this counts distinct patients *connected* to the facility -
    referred to it, or seen by a doctor attached to it - which understates real
    footfall. ``basis`` spells that out for whoever reads the number.
    """

    value: int
    is_proxy: bool
    basis: str
    referred_patients: int
    seen_by_facility_doctors: int
    stock_updates: int


class FacilityDashboard(BaseModel):
    facility: FacilitySummary
    window_days: int
    from_date: date
    to_date: date
    patient_load: PatientLoad
    referral_completion_rate: RateStat
    follow_up_completion_rate: RateStat


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
    # Only used when this call creates the patient. A raw age is no longer
    # accepted: it would be a snapshot that goes stale. Unknown fields are
    # ignored rather than rejected, so an older agent build keeps working.
    date_of_birth: date | None = None
    gender: str | None = None
    village: str | None = None
    preferred_language: str | None = None

    _check_dob = field_validator("date_of_birth")(check_date_of_birth)

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
    # Optional, and only kept alongside a high-risk flag.
    follow_up_due_date: date | None = None


class ConsultationNoteOut(BaseModel):
    model_config = ORM

    id: int
    note_text: str
    is_high_risk: bool
    high_risk_reason: str | None
    follow_up_due_date: date | None
    follow_up_resolved: bool
    created_at: datetime
    doctor: DoctorOut
    referred_to_facility: FacilitySummary | None


class FollowUpUpdate(BaseModel):
    """Patch a note's follow-up.

    Both fields are optional, and an explicit null due date clears it. The
    router reads ``model_fields_set`` to tell "clear this" from "leave alone".
    """

    follow_up_due_date: date | None = None
    follow_up_resolved: bool | None = None

    @model_validator(mode="after")
    def require_one_field(self) -> "FollowUpUpdate":
        if not self.model_fields_set:
            raise ValueError(
                "Provide follow_up_due_date, follow_up_resolved, or both."
            )
        return self


class FollowUpItem(BaseModel):
    """One patient who is due a check-in."""

    note_id: int
    unique_code: str
    name: str
    # Computed from date of birth at request time; null if it was never given.
    age: int | None
    age_label: str | None
    gender: str
    village: str
    phone: str
    follow_up_due_date: date
    # 0 on the day it falls due, growing after that.
    days_overdue: int
    is_high_risk: bool
    high_risk_reason: str | None
    note_text: str
    doctor_name: str
    created_at: datetime


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
    # Required for every new registration. Age is derived from it, never sent.
    date_of_birth: date
    gender: str = Field(min_length=1, max_length=20)
    phone: str = Field(min_length=4, max_length=20)
    village: str = Field(min_length=1, max_length=120)
    preferred_language: str = Field(min_length=1, max_length=40)

    _check_dob = field_validator("date_of_birth")(check_date_of_birth)


class PatientUpdate(BaseModel):
    """What a patient can change about themselves. For now: date of birth,
    which patients registered before it existed are asked to fill in once."""

    date_of_birth: date

    _check_dob = field_validator("date_of_birth")(check_date_of_birth)


class PatientOut(BaseModel):
    model_config = ORM

    id: int
    unique_code: str
    name: str
    date_of_birth: date | None
    gender: str
    phone: str
    village: str
    preferred_language: str
    created_at: datetime

    # Computed fields, not columns. There is deliberately no plain age field:
    # with from_attributes, a field named age would read the legacy stored
    # column. These can only ever come from date_of_birth, at request time.
    @computed_field  # type: ignore[prop-decorator]
    @property
    def age(self) -> int | None:
        computed = age_on(self.date_of_birth, today())
        return computed.years if computed else None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def age_label(self) -> str | None:
        computed = age_on(self.date_of_birth, today())
        return computed.label if computed else None


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
    # Computed from date of birth at request time; null if it was never given.
    age: int | None
    age_label: str | None
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


# --- Uploaded medical documents -----------------------------------------------

DOCUMENT_DISCLAIMER = (
    "This summary is for information only. It is not medical advice or a "
    "diagnosis, and it may contain mistakes. Always talk to a doctor about your "
    "health before acting on it."
)


class MedicalDocumentOut(BaseModel):
    model_config = ORM

    id: int
    hospital_name: str | None
    visit_date: date | None
    # True when the patient typed it; false when extraction read it.
    hospital_name_entered: bool
    visit_date_entered: bool
    original_filename: str
    file_size: int
    uploaded_at: datetime
    status: DocumentStatus
    failure_reason: str | None
    processed_at: datetime | None
    extracted_summary: ExtractedSummary | None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def file_url(self) -> str:
        return f"/documents/{self.id}/file"

    # Travels with every summary, so no client can show one without it.
    @computed_field  # type: ignore[prop-decorator]
    @property
    def disclaimer(self) -> str:
        return DOCUMENT_DISCLAIMER


# --- Doctor timeline -----------------------------------------------------------


class TimelineEntry(BaseModel):
    """One event in the merged history. Exactly one payload field is set,
    matching kind, so the client renders detail with types it already knows."""

    kind: Literal["document", "triage", "note", "referral"]
    date: date
    # True for a document with no known visit date. It is placed by upload
    # date, and no age is computed: the upload date is not the visit date.
    date_is_estimated: bool
    # The hospital that produced it, or "MedLink" for native events.
    source: str
    title: str
    # Age on this entry's date, from date of birth. Null when the date of
    # birth is unknown or the date itself is only estimated.
    age_at_date: int | None
    age_at_date_label: str | None

    document: MedicalDocumentOut | None = None
    triage: TriageEntryOut | None = None
    note: ConsultationNoteOut | None = None
    referral: ReferralOut | None = None


class PatientTimeline(BaseModel):
    patient: PatientOut
    # Oldest first: hospital A, then hospital B, then MedLink, in date order.
    entries: list[TimelineEntry]


TriageByPhoneResult.model_rebuild()
