"""Ephemeral doctor sessions.

Part 1 has no authentication: this records who is using the app so notes can
be attributed. Credential verification arrives in Part 3.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Doctor, Facility
from app.schemas import DoctorCreate, DoctorOut

router = APIRouter(prefix="/doctors", tags=["doctors"])


@router.post("", response_model=DoctorOut, status_code=status.HTTP_201_CREATED)
def create_doctor(payload: DoctorCreate, db: Session = Depends(get_db)) -> Doctor:
    if (
        payload.facility_id is not None
        and db.get(Facility, payload.facility_id) is None
    ):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No facility with id {payload.facility_id}"
        )

    doctor = Doctor(**payload.model_dump())
    db.add(doctor)
    db.commit()
    db.refresh(doctor, attribute_names=["facility"])
    return doctor
