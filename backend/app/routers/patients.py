"""Patient identity, record retrieval, timeline, triage entries and doctor notes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.ages import age_on, today
from app.database import get_db
from app.models import ConsultationNote, Doctor, Facility, Patient, TriageEntry
from app.queries import create_patient as allocate_patient, load_patient, queue_position
from app.routers.sign_in import valid_mobile
from app.timeline import build_timeline
from app.triage_assessment import assess
from app.schemas import (
    ConsultationNoteCreate,
    ConsultationNoteOut,
    PatientCreate,
    PatientOut,
    PatientRecord,
    PatientTimeline,
    PatientUpdate,
    ReferralOut,
    TriageEntryCreate,
    TriageEntryOut,
)

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientCreate, db: Session = Depends(get_db)) -> Patient:
    """Capture a patient's identity and allocate their unique MedLink ID.

    The number may already belong to other patients (a family handset), but
    never to a doctor - create_patient refuses that.
    """
    fields = payload.model_dump()
    fields["phone"] = valid_mobile(payload.phone)
    return allocate_patient(db, **fields)


@router.get("/{unique_code}", response_model=PatientRecord)
def get_patient(unique_code: str, db: Session = Depends(get_db)) -> PatientRecord:
    """Full record: demographics, triage, notes, referrals and queue position."""
    patient = load_patient(db, unique_code, with_history=True)
    record = PatientRecord.model_validate(patient)
    record.queue_position = queue_position(db, patient.id)
    return record


@router.patch("/{unique_code}", response_model=PatientOut)
def update_patient(
    unique_code: str, payload: PatientUpdate, db: Session = Depends(get_db)
) -> Patient:
    """Fill in details a patient did not give at registration.

    Exists for the one-time prompt shown to patients registered before date of
    birth was collected. Only date of birth is editable for now.
    """
    patient = load_patient(db, unique_code)
    patient.date_of_birth = payload.date_of_birth
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/{unique_code}/timeline", response_model=PatientTimeline)
def get_timeline(unique_code: str, db: Session = Depends(get_db)) -> PatientTimeline:
    """Uploaded records and MedLink history merged, oldest first, each with
    the patient's computed age on that date."""
    patient = load_patient(db, unique_code, with_history=True, with_documents=True)
    return build_timeline(patient)


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
    """Save one completed symptom check and return it with its result.

    The answers are committed before the assessment runs, so a Gemini failure
    or timeout never loses them. The assessment itself never raises.
    """
    patient = load_patient(db, unique_code)
    answers = [answer.model_dump(exclude_none=True) for answer in payload.answers]
    summary = payload.summary or "; ".join(
        f"{answer['question']}: {answer['answer']}" for answer in answers
    )

    entry = TriageEntry(patient_id=patient.id, summary=summary, answers=answers)
    db.add(entry)
    db.commit()

    age = age_on(patient.date_of_birth, today())
    assessment = assess(answers, age.label if age else None, patient.gender)
    entry.urgency = assessment["urgency"]
    entry.assessment = assessment
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
