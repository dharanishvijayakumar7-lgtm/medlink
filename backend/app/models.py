"""Database models for MedLink Part 1."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Human-shareable identifier, format "MED-XXXXXX".
    unique_code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    age: Mapped[int] = mapped_column(Integer)
    gender: Mapped[str] = mapped_column(String(20))
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


class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    specialization: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Facility(Base):
    __tablename__ = "facilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    # Sub-Centre / PHC / CHC / District Hospital
    type: Mapped[str] = mapped_column(String(60))
    area_label: Mapped[str] = mapped_column(String(160))


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
    # Part 1 referrals are an untracked note: stored and displayed, no status workflow.
    referred_to_facility_id: Mapped[int | None] = mapped_column(
        ForeignKey("facilities.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    patient: Mapped["Patient"] = relationship(back_populates="notes")
    doctor: Mapped["Doctor"] = relationship()
    referred_to_facility: Mapped["Facility | None"] = relationship()
