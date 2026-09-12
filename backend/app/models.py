"""Database models for MedLink.

Part 1 built the patient/doctor loop. Part 2 adds teleconsultation rooms,
tracked referrals, facility stock, queue status and voice-agent handoff.
"""

from datetime import datetime, timezone
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
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


# --- Core records -----------------------------------------------------------


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Human-shareable identifier, format "MED-XXXXXX".
    unique_code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    age: Mapped[int] = mapped_column(Integer)
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
