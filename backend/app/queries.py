"""Database helpers shared by more than one router."""

import secrets

from fastapi import HTTPException, status as http_status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import (
    ConsultationNote,
    Doctor,
    Patient,
    Referral,
    TriageEntry,
    TriageStatus,
)

# Number of times to retry when a generated code collides with an existing one.
CODE_ATTEMPTS = 10


def new_patient_code() -> str:
    """A human-shareable patient ID: MED- followed by 6 random digits."""
    return f"MED-{secrets.randbelow(1_000_000):06d}"


def normalise_phone(raw: str) -> str:
    """Reduce a dialled number to the digits that identify the caller.

    Indian mobile numbers are 10 digits; anything longer is assumed to carry a
    country code or trunk prefix, so only the last 10 are kept. Every write path
    stores this canonical form, which is what lets the voice agent find an app
    patient - and the app find a phone-only one - by number alone, whether it
    arrives as 9876543210, +919876543210 or 09876543210.
    """
    digits = "".join(character for character in raw if character.isdigit())
    return digits[-10:] if len(digits) > 10 else digits


def create_patient(db: Session, **fields) -> Patient:
    """Insert a patient with a freshly allocated, unique MedLink ID.

    Used by app registration and by the voice agent's phone handoff, so the
    collision retry and phone normalisation live in one place.
    """
    if "phone" in fields:
        fields["phone"] = normalise_phone(fields["phone"])

    for _ in range(CODE_ATTEMPTS):
        patient = Patient(unique_code=new_patient_code(), **fields)
        db.add(patient)
        try:
            db.commit()
        except IntegrityError:
            # The code was taken between generation and insert; try another one.
            db.rollback()
            continue
        db.refresh(patient)
        return patient

    raise HTTPException(
        http_status.HTTP_503_SERVICE_UNAVAILABLE,
        "Could not allocate a unique patient ID. Please try again.",
    )


def load_patient(db: Session, unique_code: str, *, with_history: bool = False) -> Patient:
    """Find a patient by their MedLink ID, or raise 404.

    Codes are matched case-insensitively so "med-482119" works as typed.
    """
    query = db.query(Patient)

    if with_history:
        # Every nested relationship the record schema serialises is eager-loaded,
        # including each doctor's facility, so a long history stays one query per
        # relationship rather than one per row.
        query = query.options(
            selectinload(Patient.triage_entries),
            selectinload(Patient.notes)
            .selectinload(ConsultationNote.doctor)
            .selectinload(Doctor.facility),
            selectinload(Patient.notes).selectinload(
                ConsultationNote.referred_to_facility
            ),
            selectinload(Patient.referrals)
            .selectinload(Referral.doctor)
            .selectinload(Doctor.facility),
            selectinload(Patient.referrals).selectinload(Referral.to_facility),
        )

    patient = query.filter(Patient.unique_code == unique_code.strip().upper()).first()
    if patient is None:
        raise HTTPException(
            http_status.HTTP_404_NOT_FOUND, f"No patient found with ID {unique_code}"
        )
    return patient


def queue_position(db: Session, patient_id: int) -> int | None:
    """1-based place in the WAITING queue, or None when nothing is waiting.

    A patient with several waiting entries is placed by their earliest one, so
    submitting another symptom check never costs them their spot.
    """
    mine = (
        db.query(TriageEntry)
        .filter(
            TriageEntry.patient_id == patient_id,
            TriageEntry.status == TriageStatus.WAITING,
        )
        .order_by(TriageEntry.created_at.asc())
        .first()
    )
    if mine is None:
        return None

    ahead = (
        db.query(func.count(TriageEntry.id))
        .filter(
            TriageEntry.status == TriageStatus.WAITING,
            TriageEntry.created_at < mine.created_at,
        )
        .scalar()
    )
    return int(ahead or 0) + 1
