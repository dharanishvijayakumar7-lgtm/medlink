"""Tracked referrals.

Part 1 stored a referral as a line on a consultation note and nothing more.
Here it becomes a record with a status the patient can actually follow:
PENDING -> CONFIRMED -> COMPLETED, or NO_SHOW.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Doctor, Facility, Referral
from app.queries import load_patient
from app.schemas import ReferralCreate, ReferralOut, ReferralStatusUpdate

router = APIRouter(prefix="/referrals", tags=["referrals"])


@router.post("", response_model=ReferralOut, status_code=status.HTTP_201_CREATED)
def create_referral(
    payload: ReferralCreate, db: Session = Depends(get_db)
) -> Referral:
    """A doctor refers a patient to a facility."""
    patient = load_patient(db, payload.patient_unique_code)

    if db.get(Doctor, payload.doctor_id) is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No doctor session with id {payload.doctor_id}"
        )
    if db.get(Facility, payload.to_facility_id) is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No facility with id {payload.to_facility_id}"
        )

    referral = Referral(
        patient_id=patient.id,
        doctor_id=payload.doctor_id,
        to_facility_id=payload.to_facility_id,
        notes=payload.notes,
    )
    db.add(referral)
    db.commit()
    db.refresh(referral, attribute_names=["doctor", "to_facility"])
    return referral


@router.patch("/{referral_id}/status", response_model=ReferralOut)
def update_referral_status(
    referral_id: int, payload: ReferralStatusUpdate, db: Session = Depends(get_db)
) -> Referral:
    """Advance a referral. The patient sees this change on their record."""
    referral = db.get(Referral, referral_id)
    if referral is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No referral with id {referral_id}"
        )

    referral.status = payload.status
    db.commit()
    # Full refresh, not just the relationships: updated_at is set by onupdate
    # during flush, so a partial refresh would return the pre-update timestamp.
    db.refresh(referral)
    return referral
