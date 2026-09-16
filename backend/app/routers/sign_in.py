"""Mobile-number sign-in for patients and doctors.

There is no OTP yet: the number says who is using the app, it does not prove
it. A number belongs to one doctor, or to one or more patients who share a
family handset - never to both.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.ages import age_on, today
from app.database import get_db
from app.models import Doctor, Patient
from app.queries import is_mobile, normalise_phone
from app.schemas import DoctorOut, PatientChoice, PhoneLookup, SignInLookup

router = APIRouter(prefix="/sign-in", tags=["sign-in"])


def valid_mobile(raw: str) -> str:
    """The normalised number, or 422 if it is not an Indian mobile number."""
    phone = normalise_phone(raw)
    if not is_mobile(phone):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Enter a 10-digit mobile number.",
        )
    return phone


# A POST, so the number never lands in a URL or an access log.
@router.post("/lookup", response_model=SignInLookup)
def lookup(payload: PhoneLookup, db: Session = Depends(get_db)) -> SignInLookup:
    phone = valid_mobile(payload.phone)

    doctor = (
        db.query(Doctor)
        .options(selectinload(Doctor.facility))
        .filter(Doctor.phone == phone)
        .first()
    )
    if doctor is not None:
        return SignInLookup(
            phone=phone,
            role="doctor",
            patients=[],
            doctor=DoctorOut.model_validate(doctor),
        )

    patients = (
        db.query(Patient)
        .filter(Patient.phone == phone)
        .order_by(Patient.created_at.asc())
        .all()
    )
    choices = []
    for patient in patients:
        age = age_on(patient.date_of_birth, today())
        choices.append(
            PatientChoice(
                unique_code=patient.unique_code,
                name=patient.name,
                gender=patient.gender,
                age_label=age.label if age else None,
            )
        )
    return SignInLookup(
        phone=phone,
        role="patient" if choices else None,
        patients=choices,
        doctor=None,
    )
