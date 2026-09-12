"""Facility list, and the medicine / diagnostic stock a doctor maintains."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Facility, FacilityStock
from app.schemas import FacilityOut, StockItemOut, StockItemUpdate

router = APIRouter(prefix="/facilities", tags=["facilities"])


def _load_facility(db: Session, facility_id: int) -> Facility:
    facility = db.get(Facility, facility_id)
    if facility is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No facility with id {facility_id}"
        )
    return facility


@router.get("", response_model=list[FacilityOut])
def list_facilities(db: Session = Depends(get_db)) -> list[Facility]:
    """Every facility with its current stock, so the patient sees availability
    on the finder itself rather than after travelling."""
    return (
        db.query(Facility)
        .options(selectinload(Facility.stock))
        .order_by(Facility.id)
        .all()
    )


@router.get("/{facility_id}/stock", response_model=list[StockItemOut])
def list_facility_stock(
    facility_id: int, db: Session = Depends(get_db)
) -> list[FacilityStock]:
    facility = _load_facility(db, facility_id)
    return facility.stock


@router.patch("/{facility_id}/stock/{item_id}", response_model=StockItemOut)
def update_stock_item(
    facility_id: int,
    item_id: int,
    payload: StockItemUpdate,
    db: Session = Depends(get_db),
) -> FacilityStock:
    """Mark one item in stock or out of stock."""
    _load_facility(db, facility_id)

    item = db.get(FacilityStock, item_id)
    if item is None or item.facility_id != facility_id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"No stock item {item_id} at facility {facility_id}",
        )

    item.available = payload.available
    db.commit()
    db.refresh(item)
    return item
