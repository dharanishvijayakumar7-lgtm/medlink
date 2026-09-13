"""Database models for MedLink.

Part 1 built the patient/doctor loop. Part 2 adds teleconsultation rooms,
tracked referrals, facility stock, queue status and voice-agent handoff.
"""

from datetime import date, datetime, timezone
from enum import StrEnum

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --- Value sets -------------------------------------------------------------
#
# Stored as plain VARCHAR rather than a native PostgreSQL enum: the values are
# validated by Pydantic at the API boundary, and adding a new one later needs
# no database migration.


class TriageStatus(StrEnum):
    WAITING = "WAITING"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"


class TriageSource(StrEnum):
    APP = "app"
    VOICE_CALL = "voice_call"


class ReferralStatus(StrEnum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    NO_SHOW = "NO_SHOW"


class StockItemType(StrEnum):
    MEDICINE = "medicine"
    DIAGNOSTIC = "diagnostic"


class ConsultationStatus(StrEnum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    ENDED = "ENDED"


class DocumentStatus(StrEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    DONE = "DONE"
    FAILED = "FAILED"


# --- Core records -----------------------------------------------------------


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Human-shareable identifier, format "MED-XXXXXX".
    unique_code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    # Source of truth for age. Nullable only because patients registered before
    # it existed never gave one - it is left null for them, never fabricated.
    # Every displayed age is computed from this at request time.
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    # LEGACY. The self-reported number captured before date_of_birth existed.
    # Kept (not dropped) so old rows lose no data, but no code reads or writes
    # it any more: a stored age is a snapshot that is wrong a year later.
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str] = mapped_column(String(20))
    # The voice agent matches callers on this, so it carries identity weight.
    phone: Mapped[str] = mapped_column(String(20), index=True)
    village: Mapped[str] = mapped_column(String(120))
    preferred_language: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    triage_entries: Mapped[list["TriageEntry"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="TriageEntry.created_at.desc()",
    )
    notes: Mapped[list["ConsultationNote"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="ConsultationNote.created_at.desc()",
    )
    referrals: Mapped[list["Referral"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="Referral.created_at.desc()",
    )
    documents: Mapped[list["MedicalDocument"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="MedicalDocument.uploaded_at.desc()",
    )


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    specialization: Mapped[str] = mapped_column(String(120))
    # Which facility's stock this doctor maintains. Optional.
    facility_id: Mapped[int | None] = mapped_column(
        ForeignKey("facilities.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    facility: Mapped["Facility | None"] = relationship()


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    # Sub-Centre / PHC / CHC / District Hospital
    type: Mapped[str] = mapped_column(String(60))
    area_label: Mapped[str] = mapped_column(String(160))

    stock: Mapped[list["FacilityStock"]] = relationship(
        back_populates="facility",
        cascade="all, delete-orphan",
        order_by="FacilityStock.item_type, FacilityStock.item_name",
    )


class TriageEntry(Base):
    __tablename__ = "triage_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    # One-line roll-up shown in the doctor queue.
    summary: Mapped[str] = mapped_column(Text)
    # Raw question/answer pairs from the guided symptom check.
    answers: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    # Drives the live queue position shown to the patient.
    status: Mapped[str] = mapped_column(
        String(20), default=TriageStatus.WAITING, index=True
    )
    # "app" or "voice_call" - where this triage came from.
    source: Mapped[str] = mapped_column(String(20), default=TriageSource.APP, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    patient: Mapped["Patient"] = relationship(back_populates="triage_entries")


class ConsultationNote(Base):
    __tablename__ = "consultation_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"), index=True)
    note_text: Mapped[str] = mapped_column(Text)
    is_high_risk: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    high_risk_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Part 1's lightweight referral note. Tracked referrals live in Referral.
    referred_to_facility_id: Mapped[int | None] = mapped_column(
        ForeignKey("facilities.id"), nullable=True
    )
    # When the doctor wants to see this patient again. Set by hand alongside a
    # high-risk flag - nothing here is auto-computed from the note.
    follow_up_due_date: Mapped[date | None] = mapped_column(
        Date, nullable=True, index=True
    )
    follow_up_resolved: Mapped[bool] = mapped_column(
        Boolean, default=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    patient: Mapped["Patient"] = relationship(back_populates="notes")
    doctor: Mapped["Doctor"] = relationship()
    referred_to_facility: Mapped["Facility | None"] = relationship()


# --- Part 2 -----------------------------------------------------------------


class Referral(Base):
    """A referral with a status a patient can actually follow."""

    __tablename__ = "referrals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"), index=True)
    to_facility_id: Mapped[int] = mapped_column(ForeignKey("facilities.id"), index=True)
    status: Mapped[str] = mapped_column(
        String(20), default=ReferralStatus.PENDING, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    patient: Mapped["Patient"] = relationship(back_populates="referrals")
    doctor: Mapped["Doctor"] = relationship()
    to_facility: Mapped["Facility"] = relationship()


class FacilityStock(Base):
    """What a facility currently has, so a patient knows before travelling."""

    __tablename__ = "facility_stock"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    facility_id: Mapped[int] = mapped_column(
        ForeignKey("facilities.id", ondelete="CASCADE"), index=True
    )
    item_name: Mapped[str] = mapped_column(String(120))
    item_type: Mapped[str] = mapped_column(String(20), index=True)
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    facility: Mapped["Facility"] = relationship(back_populates="stock")


class Consultation(Base):
    """A LiveKit room for a doctor-initiated video/audio consultation."""

    __tablename__ = "consultations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"), index=True)
    room_name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    status: Mapped[str] = mapped_column(
        String(20), default=ConsultationStatus.PENDING, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    patient: Mapped["Patient"] = relationship()
    doctor: Mapped["Doctor"] = relationship()


class MedicalDocument(Base):
    """A record from another hospital, uploaded by the patient as a PDF.

    Deliberately separate from MedLink's own history (triage, notes, referrals):
    the patient sees documents under "My Documents", and only the doctor's
    timeline merges the two.
    """

    __tablename__ = "medical_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    # Resolved values: what the patient typed wins, else what extraction read.
    # The raw extracted values stay inside extracted_summary for comparison.
    hospital_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    visit_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    hospital_name_entered: Mapped[bool] = mapped_column(Boolean, default=False)
    visit_date_entered: Mapped[bool] = mapped_column(Boolean, default=False)

    original_filename: Mapped[str] = mapped_column(String(255))
    # Relative to settings.uploads_dir, so the folder can move.
    file_path: Mapped[str] = mapped_column(String(500))
    file_size: Mapped[int] = mapped_column(Integer)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    status: Mapped[str] = mapped_column(
        String(20), default=DocumentStatus.PENDING, index=True
    )
    # ExtractedSummary as JSON: symptoms, medications, deficiencies, excesses,
    # key_terms, plain_summary, suggested_next_steps (+ hospital, date, age read).
    extracted_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # A message safe to show the patient when status is FAILED.
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    patient: Mapped["Patient"] = relationship(back_populates="documents")
