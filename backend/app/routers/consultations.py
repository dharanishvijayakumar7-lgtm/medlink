"""Teleconsultation rooms on LiveKit.

Signalling is poll-based for now: the doctor starts a consultation, and the
patient picks it up the next time their home screen loads or refreshes. Real
push notification is a later part.
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.livekit_service import LiveKitNotConfigured, mint_token, new_room_name
from app.models import Consultation, ConsultationStatus, Doctor, utcnow
from app.queries import load_patient
from app.schemas import ConsultationOut, ConsultationStart

router = APIRouter(prefix="/consultations", tags=["consultations"])

# How long a started consultation stays joinable by the patient. Without this a
# call the doctor abandoned would prompt the patient indefinitely.
PENDING_WINDOW = timedelta(minutes=30)


def _to_out(consultation: Consultation, token: str) -> ConsultationOut:
    return ConsultationOut(
        id=consultation.id,
        room_name=consultation.room_name,
        token=token,
        livekit_url=settings.livekit_url,
        status=consultation.status,
        created_at=consultation.created_at,
        patient_name=consultation.patient.name,
        patient_unique_code=consultation.patient.unique_code,
        doctor_name=consultation.doctor.name,
    )


def _mint(consultation: Consultation, *, as_doctor: bool) -> str:
    """Mint a join token for one side of the call."""
    if as_doctor:
        identity = f"doctor-{consultation.doctor_id}"
        display_name = f"Dr. {consultation.doctor.name}"
    else:
        identity = f"patient-{consultation.patient.unique_code}"
        display_name = consultation.patient.name

    try:
        return mint_token(
            room_name=consultation.room_name,
            identity=identity,
            display_name=display_name,
        )
    except LiveKitNotConfigured as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(error)) from error


@router.post(
    "/{unique_code}/start",
    response_model=ConsultationOut,
    status_code=status.HTTP_201_CREATED,
)
def start_consultation(
    unique_code: str, payload: ConsultationStart, db: Session = Depends(get_db)
) -> ConsultationOut:
    """Doctor opens a room and gets their own join token.

    The room itself is created by LiveKit when the first participant joins.
    """
    patient = load_patient(db, unique_code)

    doctor = db.get(Doctor, payload.doctor_id)
    if doctor is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No doctor session with id {payload.doctor_id}"
        )

    # One live consultation per patient: reuse any room still inside the window
    # so a doctor tapping twice does not strand the patient in the first room.
    existing = (
        db.query(Consultation)
        .filter(
            Consultation.patient_id == patient.id,
            Consultation.status == ConsultationStatus.PENDING,
            Consultation.created_at >= utcnow() - PENDING_WINDOW,
        )
        .order_by(Consultation.created_at.desc())
        .first()
    )

    if existing is not None and existing.doctor_id == doctor.id:
        consultation = existing
    else:
        if existing is not None:
            # A different doctor is taking over; close the previous room.
            existing.status = ConsultationStatus.ENDED
            existing.ended_at = utcnow()

        consultation = Consultation(
            patient_id=patient.id,
            doctor_id=doctor.id,
            room_name=new_room_name(patient.unique_code),
        )
        db.add(consultation)
        db.commit()
        db.refresh(consultation)

    token = _mint(consultation, as_doctor=True)
    return _to_out(consultation, token)


@router.get("/pending/{unique_code}", response_model=ConsultationOut | None)
def pending_consultation(
    unique_code: str, db: Session = Depends(get_db)
) -> ConsultationOut | None:
    """The consultation waiting for this patient, with a fresh patient token.

    Returns null when nothing is waiting, so the app can poll this cheaply.
    """
    patient = load_patient(db, unique_code)

    consultation = (
        db.query(Consultation)
        .filter(
            Consultation.patient_id == patient.id,
            Consultation.status == ConsultationStatus.PENDING,
            Consultation.created_at >= utcnow() - PENDING_WINDOW,
        )
        .order_by(Consultation.created_at.desc())
        .first()
    )
    if consultation is None:
        return None

    token = _mint(consultation, as_doctor=False)
    return _to_out(consultation, token)


@router.post("/{consultation_id}/end", response_model=ConsultationOut)
def end_consultation(
    consultation_id: int, db: Session = Depends(get_db)
) -> ConsultationOut:
    """Close the room so the patient stops being prompted to join.

    Not in the Part 2 endpoint list, but without it an ended call keeps
    prompting the patient until the 30 minute window lapses.
    """
    consultation = db.get(Consultation, consultation_id)
    if consultation is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No consultation with id {consultation_id}"
        )

    if consultation.status != ConsultationStatus.ENDED:
        consultation.status = ConsultationStatus.ENDED
        consultation.ended_at = utcnow()
        db.commit()
        db.refresh(consultation)

    # No token: the room is closed, so there is nothing to join.
    return _to_out(consultation, token="")
