"""Doctor-facing queues, triage status, and the voice-agent phone handoff."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Patient, TriageEntry, TriageSource, TriageStatus
from app.queries import create_patient, normalise_phone
from app.schemas import (
    QueueItem,
    TriageByPhoneCreate,
    TriageByPhoneResult,
    TriageEntryOut,
    TriageStatusUpdate,
)

router = APIRouter(prefix="/triage", tags=["triage"])


def _build_item(patient: Patient) -> tuple[QueueItem, datetime, datetime]:
    """Return the queue row plus its triage and overall activity sort keys.

    ``patient.triage_entries`` and ``patient.notes`` are both ordered newest
    first by the relationship definitions, so index 0 is the latest of each.
    """
    latest_triage = patient.triage_entries[0] if patient.triage_entries else None
    high_risk_notes = [note for note in patient.notes if note.is_high_risk]

    item = QueueItem(
        unique_code=patient.unique_code,
        name=patient.name,
        age=patient.age,
        gender=patient.gender,
        village=patient.village,
        is_high_risk=bool(high_risk_notes),
        high_risk_reason=high_risk_notes[0].high_risk_reason if high_risk_notes else None,
        latest_triage_id=latest_triage.id if latest_triage else None,
        latest_triage_summary=latest_triage.summary if latest_triage else None,
        latest_triage_at=latest_triage.created_at if latest_triage else None,
        latest_triage_status=latest_triage.status if latest_triage else None,
        latest_triage_source=latest_triage.source if latest_triage else None,
        triage_count=len(patient.triage_entries),
        note_count=len(patient.notes),
    )

    triage_at = latest_triage.created_at if latest_triage else patient.created_at
    last_note_at = patient.notes[0].created_at if patient.notes else patient.created_at
    return item, triage_at, max(triage_at, last_note_at)


def _all_patients(db: Session) -> list[Patient]:
    return (
        db.query(Patient)
        .options(selectinload(Patient.triage_entries), selectinload(Patient.notes))
        .all()
    )


@router.get("/recent", response_model=list[QueueItem])
def recent_queue(
    limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)
) -> list[QueueItem]:
    """Patients with at least one symptom check, newest submission first."""
    rows = [
        _build_item(patient) for patient in _all_patients(db) if patient.triage_entries
    ]
    rows.sort(key=lambda row: row[1], reverse=True)
    return [item for item, _, _ in rows[:limit]]


@router.get("/high-risk", response_model=list[QueueItem])
def high_risk_queue(
    limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)
) -> list[QueueItem]:
    """Patients a doctor has flagged high-risk, most recent activity first.

    Unlike ``/triage/recent`` this is not restricted to patients who have
    submitted a symptom check - a flagged patient belongs on the worklist
    either way.
    """
    rows = [
        _build_item(patient)
        for patient in _all_patients(db)
        if any(note.is_high_risk for note in patient.notes)
    ]
    rows.sort(key=lambda row: row[2], reverse=True)
    return [item for item, _, _ in rows[:limit]]


@router.patch("/{entry_id}/status", response_model=TriageEntryOut)
def update_triage_status(
    entry_id: int, payload: TriageStatusUpdate, db: Session = Depends(get_db)
) -> TriageEntry:
    """Move a patient through WAITING -> IN_PROGRESS -> DONE."""
    entry = db.get(TriageEntry, entry_id)
    if entry is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No triage entry with id {entry_id}"
        )

    entry.status = payload.status
    db.commit()
    db.refresh(entry)
    return entry


@router.post(
    "/by-phone",
    response_model=TriageByPhoneResult,
    status_code=status.HTTP_201_CREATED,
    tags=["voice-agent"],
)
def triage_by_phone(
    payload: TriageByPhoneCreate, db: Session = Depends(get_db)
) -> TriageByPhoneResult:
    """Record a triage that happened over the phone with the voice agent.

    Called by the voice agent, not by the app. The caller is matched purely on
    phone number; a patient record is created when no match exists, so a person
    who has only ever phoned in still turns up in the doctor's queue.
    """
    phone = normalise_phone(payload.phone)
    if len(phone) < 4:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "phone must contain at least 4 digits",
        )

    # A phone number is not unique: households in rural India share one handset,
    # so several patients can legitimately carry the same number. The agent has
    # no way to tell which of them is calling, so the most recently registered
    # patient on that number wins - deterministic, and the best available guess.
    # Naming the caller during the call is what will disambiguate this properly.
    patient = (
        db.query(Patient)
        .filter(Patient.phone == phone)
        .order_by(Patient.created_at.desc())
        .first()
    )
    created_patient = patient is None

    if patient is None:
        patient = create_patient(
            db,
            name=payload.name or f"Caller {phone[-4:]}",
            age=payload.age if payload.age is not None else 0,
            gender=payload.gender or "Unknown",
            phone=phone,
            village=payload.village or "Unknown",
            preferred_language=payload.preferred_language or "Unknown",
        )

    answers = [answer.model_dump() for answer in payload.answers]
    summary = payload.summary or "; ".join(
        f"{answer['question']}: {answer['answer']}" for answer in answers
    )

    entry = TriageEntry(
        patient_id=patient.id,
        summary=summary,
        answers=answers,
        source=TriageSource.VOICE_CALL,
        status=TriageStatus.WAITING,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return TriageByPhoneResult(
        patient=patient, entry=entry, created_patient=created_patient
    )
