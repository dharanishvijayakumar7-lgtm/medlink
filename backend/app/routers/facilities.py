"""Facility list, the stock a doctor maintains, the facility dashboard, and
real clinics and hospitals near a patient."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from app import nearby
from app.database import get_db
from app.models import (
    ConsultationNote,
    Doctor,
    Facility,
    FacilityStock,
    Referral,
    ReferralStatus,
    utcnow,
)
from app.schemas import (
    FacilityDashboard,
    FacilityOut,
    FacilitySummary,
    LocatedPlace,
    NearbyFacility,
    PatientLoad,
    RateStat,
    StockItemOut,
    StockItemUpdate,
)

router = APIRouter(prefix="/facilities", tags=["facilities"])


def _rate(completed: int, total: int) -> RateStat:
    """A rate, or null when nothing was due - never a misleading 0%."""
    return RateStat(
        completed=completed,
        total=total,
        rate=round(completed / total, 4) if total else None,
    )


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


@router.get("/nearby", response_model=list[NearbyFacility])
def nearby_facilities(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> list[dict]:
    """Real clinics and hospitals within 25 km of a point, nearest first, from
    OpenStreetMap. For the patient's facility finder; doctors keep using the
    MedLink facility list above."""
    try:
        return nearby.find_nearby(lat, lng)
    except nearby.NearbyUnavailable as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Could not load nearby places right now.",
        ) from error


@router.get("/locate", response_model=LocatedPlace)
def locate_place(q: str = Query(..., min_length=2, max_length=120)) -> dict:
    """A village, town or PIN code in India, as a point for ``/nearby``."""
    try:
        place = nearby.locate(q)
    except nearby.NearbyUnavailable as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Place search is unavailable right now."
        ) from error
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Could not find that place.")
    return place


@router.get("/{facility_id}/dashboard", response_model=FacilityDashboard)
def facility_dashboard(
    facility_id: int,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
) -> FacilityDashboard:
    """Aggregate view of how a facility has been running.

    Pure read over what Parts 1 and 2 already collect - no new tables. See
    ``PatientLoad`` for why the load figure is a proxy rather than a true count.
    """
    facility = _load_facility(db, facility_id)

    now = utcnow()
    cutoff = now - timedelta(days=days)
    from_date = cutoff.date()
    to_date = now.date()

    # --- patient load (proxy) ---
    # Distinct patients referred here in the window.
    referred_ids = {
        patient_id
        for (patient_id,) in db.query(Referral.patient_id)
        .filter(
            Referral.to_facility_id == facility_id,
            Referral.created_at >= cutoff,
        )
        .distinct()
    }
    # Distinct patients any doctor attached to this facility wrote a note on.
    seen_ids = {
        patient_id
        for (patient_id,) in db.query(ConsultationNote.patient_id)
        .join(Doctor, ConsultationNote.doctor_id == Doctor.id)
        .filter(
            Doctor.facility_id == facility_id,
            ConsultationNote.created_at >= cutoff,
        )
        .distinct()
    }
    stock_updates = (
        db.query(FacilityStock)
        .filter(
            FacilityStock.facility_id == facility_id,
            FacilityStock.updated_at >= cutoff,
        )
        .count()
    )

    patient_load = PatientLoad(
        value=len(referred_ids | seen_ids),
        is_proxy=True,
        basis=(
            "Distinct patients referred to this facility or seen by a doctor "
            "attached to it. Triage entries record the patient, not the "
            "facility, so real footfall is higher than this number."
        ),
        referred_patients=len(referred_ids),
        seen_by_facility_doctors=len(seen_ids),
        stock_updates=stock_updates,
    )

    # --- referral completion (direct link, no proxy) ---
    referrals = db.query(Referral).filter(
        Referral.to_facility_id == facility_id, Referral.created_at >= cutoff
    )
    referral_total = referrals.count()
    referral_done = referrals.filter(
        Referral.status == ReferralStatus.COMPLETED
    ).count()

    # --- follow-up completion ---
    # Linked through the note's author: "did this facility's doctors close the
    # follow-ups that came due?" Counts by due date, not when the note was
    # written, so a follow-up set months ago still lands in the right window.
    follow_ups = (
        db.query(ConsultationNote)
        .join(Doctor, ConsultationNote.doctor_id == Doctor.id)
        .filter(
            Doctor.facility_id == facility_id,
            ConsultationNote.follow_up_due_date.isnot(None),
            ConsultationNote.follow_up_due_date >= from_date,
            ConsultationNote.follow_up_due_date <= to_date,
        )
    )
    follow_up_total = follow_ups.count()
    follow_up_done = follow_ups.filter(
        ConsultationNote.follow_up_resolved.is_(True)
    ).count()

    return FacilityDashboard(
        facility=FacilitySummary.model_validate(facility),
        window_days=days,
        from_date=from_date,
        to_date=to_date,
        patient_load=patient_load,
        referral_completion_rate=_rate(referral_done, referral_total),
        follow_up_completion_rate=_rate(follow_up_done, follow_up_total),
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
