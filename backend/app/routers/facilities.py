"""Seeded facility list, used by the patient finder and the referral picker."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Facility
from app.schemas import FacilityOut

router = APIRouter(prefix="/facilities", tags=["facilities"])


@router.get("", response_model=list[FacilityOut])
def list_facilities(db: Session = Depends(get_db)) -> list[Facility]:
    return db.query(Facility).order_by(Facility.id).all()
