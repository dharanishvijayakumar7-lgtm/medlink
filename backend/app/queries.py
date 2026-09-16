"""Database helpers shared by more than one router."""

import secrets
from typing import Literal

from fastapi import HTTPException, status as http_status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import (
    ConsultationNote,
    Doctor,
    MedicalDocument,
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


def is_mobile(phone: str) -> bool:
    """True for a normalised Indian mobile number: 10 digits starting 6-9."""
    return len(phone) == 10 and phone.isdigit() and phone[0] in "6789"


def phone_role(db: Session, phone: str) -> Literal["patient", "doctor"] | None:
    """Who a normalised number belongs to. A number is never both."""
    if db.query(Doctor.id).filter(Doctor.phone == phone).first():
        return "doctor"
    if db.query(Patient.id).filter(Patient.phone == phone).first():
        return "patient"
    return None


def ensure_phone_free(db: Session, phone: str, for_role: Literal["patient", "doctor"]) -> None:
    """Refuse a number that is already used by the other role.

    Several patients may share one number (a family handset), but a doctor's
    number is theirs alone and a patient's number can never become a doctor's.
    """
    owner = phone_role(db, phone)
    if owner == "doctor":
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            "This number is registered as a doctor. Use a different number.",
        )
    if owner == "patient" and for_role == "doctor":
        raise HTTPException(
            http_status.HTTP_409_CONFLICT,
            "This number is registered as a patient. Use a different number.",
        )


def create_patient(db: Session, **fields) -> Patient:
    """Insert a patient with a freshly allocated, unique MedLink ID.

    Used by app registration and by the voice agent's phone handoff, so the
    collision retry, phone normalisation and the patient/doctor number rule
    live in one place.
    """
    if "phone" in fields:
        fields["phone"] = normalise_phone(fields["phone"])
        ensure_phone_free(db, fields["phone"], "patient")

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


def load_patient(
    db: Session,
    unique_code: str,
    *,
    with_history: bool = False,
    with_documents: bool = False,
) -> Patient:
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

    if with_documents:
        # Separate from with_history: the everyday patient record does not
        # serialise documents, so it should not pay to load them.
        query = query.options(selectinload(Patient.documents))

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
