"""A patient's call history: the voice agent's call summaries, matched by phone.

The agent writes each call to Firestore; these routes read them back for the
phone number on the patient's MedLink record. No route accepts a phone number,
so a number's calls are only reachable through the patient registered with it.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app import call_summaries
from app.database import get_db
from app.queries import load_patient
from app.schemas import CallSummaryOut

logger = logging.getLogger("medlink.calls")

router = APIRouter(tags=["calls"])


@router.get("/patients/{unique_code}/calls", response_model=list[CallSummaryOut])
def patient_calls(unique_code: str, db: Session = Depends(get_db)) -> list[CallSummaryOut]:
    """Voice-agent calls from the patient's registered phone number, newest first."""
    patient = load_patient(db, unique_code)
    calls = []
    for data in call_summaries.list_calls(patient.phone):
        try:
            calls.append(CallSummaryOut.model_validate(data))
        except ValidationError:
            # The agent is a separate codebase; one odd document must not hide
            # every other call.
            logger.warning(
                "skipping unreadable call summary %s", data.get("call_id"), exc_info=True
            )
    return calls


@router.get("/patients/{unique_code}/calls/{call_id}", response_model=CallSummaryOut)
def patient_call(
    unique_code: str, call_id: str, db: Session = Depends(get_db)
) -> CallSummaryOut:
    """One call from the patient's registered phone number."""
    patient = load_patient(db, unique_code)
    data = call_summaries.get_call(patient.phone, call_id)
    try:
        return CallSummaryOut.model_validate(data)
    except ValidationError as error:
        logger.warning("unreadable call summary %s", call_id, exc_info=True)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "This call summary could not be read."
        ) from error
