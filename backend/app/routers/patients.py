"""Patient identity, record retrieval, triage entries and doctor notes."""

import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import ConsultationNote, Doctor, Facility, Patient, TriageEntry
from app.schemas import (
    ConsultationNoteCreate,
    ConsultationNoteOut,
    PatientCreate,
    PatientOut,
    PatientRecord,
    TriageEntryCreate,
    TriageEntryOut,
)

router = APIRouter(prefix="/patients", tags=["patients"])

# Number of times to retry when a generated code collides with an existing one.
CODE_ATTEMPTS = 10


def _new_code() -> str:
    """A human-shareable patient ID: MED- followed by 6 random digits."""
    return f"MED-{secrets.randbelow(1_000_000):06d}"


def _load_patient(db: Session, unique_code: str) -> Patient:
    patient = (
        db.query(Patient)
        .options(
            selectinload(Patient.triage_entries),
            selectinload(Patient.notes).selectinload(ConsultationNote.doctor),
            selectinload(Patient.notes).selectinload(
                ConsultationNote.referred_to_facility
            ),
        )
        .filter(Patient.unique_code == unique_code.strip().upper())
        .first()
    )
    if patient is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No patient found with ID {unique_code}"
        )
    return patient


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientCreate, db: Session = Depends(get_db)) -> Patient:
    """Capture a patient's identity and allocate their unique MedLink ID."""
    for _ in range(CODE_ATTEMPTS):
        patient = Patient(unique_code=_new_code(), **payload.model_dump())
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
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Could not allocate a unique patient ID. Please try again.",
    )


@router.get("/{unique_code}", response_model=PatientRecord)
def get_patient(unique_code: str, db: Session = Depends(get_db)) -> Patient:
    """Full record: demographics + triage history + every doctor note."""
    return _load_patient(db, unique_code)


@router.post(
    "/{unique_code}/triage",
    response_model=TriageEntryOut,
    status_code=status.HTTP_201_CREATED,
)
def add_triage_entry(
    unique_code: str, payload: TriageEntryCreate, db: Session = Depends(get_db)
) -> TriageEntry:
    """Save one completed symptom check against the patient's record."""
    patient = _load_patient(db, unique_code)
    answers = [answer.model_dump() for answer in payload.answers]
    summary = payload.summary or "; ".join(
        f"{answer['question']}: {answer['answer']}" for answer in answers
    )

    entry = TriageEntry(patient_id=patient.id, summary=summary, answers=answers)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.post(
    "/{unique_code}/notes",
    response_model=ConsultationNoteOut,
    status_code=status.HTTP_201_CREATED,
)
def add_consultation_note(
    unique_code: str, payload: ConsultationNoteCreate, db: Session = Depends(get_db)
) -> ConsultationNote:
    """A doctor adds a note, optionally flagging high-risk and/or a referral."""
    patient = _load_patient(db, unique_code)

    if db.get(Doctor, payload.doctor_id) is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No doctor session with id {payload.doctor_id}"
        )
    if (
        payload.referred_to_facility_id is not None
        and db.get(Facility, payload.referred_to_facility_id) is None
    ):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"No facility with id {payload.referred_to_facility_id}",
        )

    note = ConsultationNote(
        patient_id=patient.id,
        doctor_id=payload.doctor_id,
        note_text=payload.note_text,
        is_high_risk=payload.is_high_risk,
        # A reason only makes sense alongside the flag.
        high_risk_reason=payload.high_risk_reason if payload.is_high_risk else None,
        referred_to_facility_id=payload.referred_to_facility_id,
    )
    db.add(note)
    db.commit()

    db.refresh(note, attribute_names=["doctor", "referred_to_facility"])
    return note
