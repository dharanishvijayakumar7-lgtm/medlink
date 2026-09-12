"""Patient identity, record retrieval, triage entries and doctor notes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ConsultationNote, Doctor, Facility, Patient, TriageEntry
from app.queries import create_patient as allocate_patient, load_patient, queue_position
from app.schemas import (
    ConsultationNoteCreate,
    ConsultationNoteOut,
    PatientCreate,
    PatientOut,
    PatientRecord,
    ReferralOut,
    TriageEntryCreate,
    TriageEntryOut,
)

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientCreate, db: Session = Depends(get_db)) -> Patient:
    """Capture a patient's identity and allocate their unique MedLink ID."""
    return allocate_patient(db, **payload.model_dump())


@router.get("/{unique_code}", response_model=PatientRecord)
def get_patient(unique_code: str, db: Session = Depends(get_db)) -> PatientRecord:
    """Full record: demographics, triage, notes, referrals and queue position."""
    patient = load_patient(db, unique_code, with_history=True)
    record = PatientRecord.model_validate(patient)
    record.queue_position = queue_position(db, patient.id)
    return record


@router.get("/{unique_code}/referrals", response_model=list[ReferralOut])
def list_patient_referrals(
    unique_code: str, db: Session = Depends(get_db)
) -> list[ReferralOut]:
    """The patient-facing referral tracker, newest first."""
    patient = load_patient(db, unique_code, with_history=True)
    return [ReferralOut.model_validate(referral) for referral in patient.referrals]


@router.post(
    "/{unique_code}/triage",
    response_model=TriageEntryOut,
    status_code=status.HTTP_201_CREATED,
)
def add_triage_entry(
    unique_code: str, payload: TriageEntryCreate, db: Session = Depends(get_db)
) -> TriageEntry:
    """Save one completed symptom check against the patient's record."""
    patient = load_patient(db, unique_code)
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
    patient = load_patient(db, unique_code)

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
        # A reason and a follow-up date only make sense alongside the flag.
        high_risk_reason=payload.high_risk_reason if payload.is_high_risk else None,
        follow_up_due_date=(
            payload.follow_up_due_date if payload.is_high_risk else None
        ),
        referred_to_facility_id=payload.referred_to_facility_id,
    )
    db.add(note)
    db.commit()

    db.refresh(note, attribute_names=["doctor", "referred_to_facility"])
    return note
