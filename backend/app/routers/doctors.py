"""Doctor profiles.

A doctor signs in with their mobile number (see app.routers.sign_in); this
creates the profile the first time a number is used. There is no OTP yet.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Doctor, Facility
from app.queries import ensure_phone_free
from app.routers.sign_in import valid_mobile
from app.schemas import DoctorCreate, DoctorOut

router = APIRouter(prefix="/doctors", tags=["doctors"])


@router.post("", response_model=DoctorOut, status_code=status.HTTP_201_CREATED)
def create_doctor(payload: DoctorCreate, db: Session = Depends(get_db)) -> Doctor:
    phone = valid_mobile(payload.phone)
    ensure_phone_free(db, phone, "doctor")

    if (
        payload.facility_id is not None
        and db.get(Facility, payload.facility_id) is None
    ):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No facility with id {payload.facility_id}"
        )

    doctor = Doctor(**payload.model_dump(exclude={"phone"}), phone=phone)
    db.add(doctor)
    try:
        db.commit()
    except IntegrityError:
        # Two sign-ups with the same new number at once; the other one won.
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This number is already registered as a doctor. Sign in instead.",
        )
    db.refresh(doctor, attribute_names=["facility"])
    return doctor
