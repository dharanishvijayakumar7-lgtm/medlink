"""Doctor-facing queues built from triage submissions and risk flags."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Patient
from app.schemas import QueueItem

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
        latest_triage_summary=latest_triage.summary if latest_triage else None,
        latest_triage_at=latest_triage.created_at if latest_triage else None,
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
        _build_item(patient)
        for patient in _all_patients(db)
        if patient.triage_entries
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
