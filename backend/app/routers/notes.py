"""Follow-up tracking on consultation notes.

Part 1's high-risk flag said "this patient matters". A follow-up says *when*
to come back to them, and whether that has happened yet.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ConsultationNote
from app.schemas import ConsultationNoteOut, FollowUpUpdate

router = APIRouter(prefix="/notes", tags=["notes"])


@router.patch("/{note_id}/follow-up", response_model=ConsultationNoteOut)
def update_follow_up(
    note_id: int, payload: FollowUpUpdate, db: Session = Depends(get_db)
) -> ConsultationNote:
    """Reschedule a follow-up, mark it resolved, or both.

    Sending an explicit null due date clears it; omitting the field leaves it
    alone. That distinction is what ``model_fields_set`` is read for.
    """
    note = db.get(ConsultationNote, note_id)
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No note with id {note_id}")

    provided = payload.model_fields_set

    if "follow_up_due_date" in provided:
        note.follow_up_due_date = payload.follow_up_due_date
        # A cleared date cannot stay "resolved" - there is nothing to resolve.
        if payload.follow_up_due_date is None:
            note.follow_up_resolved = False

    if "follow_up_resolved" in provided and payload.follow_up_resolved is not None:
        if payload.follow_up_resolved and note.follow_up_due_date is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This note has no follow-up due date to resolve.",
            )
        note.follow_up_resolved = payload.follow_up_resolved

    db.commit()
    db.refresh(note)
    return note
