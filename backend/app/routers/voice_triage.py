"""The voice symptom check.

The app records the patient describing how they feel (a WAV, sent as the raw
request body), and this route turns it into a normal symptom check entry:
Bhashini transcribes and translates it, app.voice_triage writes the guidance,
and the entry joins the doctor queue like any other.
"""

import base64
import logging
import struct
from typing import Annotated, Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import bhashini
from app.ages import age_on, today
from app.database import get_db
from app.models import TriageEntry, TriageSource
from app.queries import load_patient
from app.schemas import TriageEntryOut
from app.voice_triage import NotUnderstood, assess_voice

logger = logging.getLogger("medlink.voice")

router = APIRouter(prefix="/patients", tags=["voice"])

# About five minutes of 16 kHz mono speech; the app stops at one minute.
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MIN_SECONDS = 1.0


def _wav_info(data: bytes) -> tuple[int, float]:
    """(sample rate, duration in seconds) of a PCM WAV, or 415."""
    if len(data) < 44 or data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Send a WAV recording.")
    rate = byte_rate = 0
    data_bytes = 0
    position = 12
    while position + 8 <= len(data):
        chunk, size = data[position : position + 4], struct.unpack("<I", data[position + 4 : position + 8])[0]
        if chunk == b"fmt ":
            _, _, rate, byte_rate = struct.unpack("<HHII", data[position + 8 : position + 20])
        elif chunk == b"data":
            data_bytes = min(size, len(data) - position - 8)
            break
        position += 8 + size + (size & 1)
    if not rate or not byte_rate:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Send a WAV recording.")
    return rate, data_bytes / byte_rate


@router.post(
    "/{unique_code}/voice-triage",
    response_model=TriageEntryOut,
    status_code=status.HTTP_201_CREATED,
)
def add_voice_triage(
    unique_code: str,
    audio: Annotated[bytes, Body(media_type="audio/wav")],
    language: Annotated[Literal["en", "hi", "ta", "te", "kn", "ml"], Query()],
    db: Session = Depends(get_db),
) -> TriageEntry:
    """Transcribe a spoken description, assess it and save it as a symptom check."""
    patient = load_patient(db, unique_code)

    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "The recording is too long.")
    rate, seconds = _wav_info(audio)
    if seconds < MIN_SECONDS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The recording is too short.")

    try:
        transcript, english = bhashini.transcribe(
            base64.b64encode(audio).decode("ascii"), language, rate
        )
    except bhashini.BhashiniNotConfigured as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Voice input is not set up on the server."
        ) from error
    except bhashini.BhashiniFailed as error:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Could not process the recording. Please try again."
        ) from error

    if not english.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "No words were heard.")

    age = age_on(patient.date_of_birth, today())
    try:
        summary, assessment = assess_voice(
            english, transcript, language, age.label if age else None, patient.gender
        )
    except NotUnderstood as error:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "That did not sound like a health problem."
        ) from error

    entry = TriageEntry(
        patient_id=patient.id,
        summary=summary,
        # English, so the doctor queue and timeline read it like any other check.
        answers=[
            {
                "id": "voice",
                "question": "What the patient said (voice, translated to English)",
                "answer": english,
            }
        ],
        source=TriageSource.APP,
        urgency=assessment["urgency"],
        assessment=assessment,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    logger.info("voice triage for %s: %s (%.1fs, %s)", unique_code, entry.urgency, seconds, language)
    return entry
