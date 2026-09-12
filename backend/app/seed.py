"""Static seed data.

Part 1 shipped a fixed facility list; Part 2 adds the medicine and diagnostic
stock behind each one. A live OpenStreetMap/Overpass lookup can replace the
facility list later without changing the API shape.
"""

from sqlalchemy.orm import Session

from app.models import Facility, FacilityStock, StockItemType

FACILITIES: list[dict[str, str]] = [
    {"name": "Ramnagar Health Sub-Centre", "type": "Sub-Centre", "area_label": "Ramnagar village - 1.2 km"},
    {"name": "Kotwa Health Sub-Centre", "type": "Sub-Centre", "area_label": "Kotwa village - 2.8 km"},
    {"name": "Bhagwanpur Health Sub-Centre", "type": "Sub-Centre", "area_label": "Bhagwanpur village - 3.5 km"},
    {"name": "Siyapur Primary Health Centre", "type": "PHC", "area_label": "Siyapur block - 4.0 km"},
    {"name": "Madhopur Primary Health Centre", "type": "PHC", "area_label": "Madhopur block - 6.5 km"},
    {"name": "Chandauli Primary Health Centre", "type": "PHC", "area_label": "Chandauli block - 9.0 km"},
    {"name": "Barhani Primary Health Centre", "type": "PHC", "area_label": "Barhani block - 11.5 km"},
    {"name": "Sakaldiha Community Health Centre", "type": "CHC", "area_label": "Sakaldiha town - 14.0 km"},
    {"name": "Chakia Community Health Centre", "type": "CHC", "area_label": "Chakia town - 18.0 km"},
    {"name": "Naugarh Community Health Centre", "type": "CHC", "area_label": "Naugarh town - 22.0 km"},
    {"name": "District Hospital Chandauli", "type": "District Hospital", "area_label": "Chandauli district HQ - 26.0 km"},
    {"name": "District Women's Hospital", "type": "District Hospital", "area_label": "Chandauli district HQ - 26.5 km"},
    {"name": "Sir Sunderlal Hospital (BHU)", "type": "Medical College", "area_label": "Varanasi - 42.0 km"},
    {"name": "Government TB & Chest Clinic", "type": "Specialist Clinic", "area_label": "Mughalsarai - 20.0 km"},
    {"name": "Mughalsarai Maternity Centre", "type": "Maternity Centre", "area_label": "Mughalsarai - 19.0 km"},
]

# How well equipped each tier of facility is, 1 (smallest) to 4 (largest).
FACILITY_LEVEL: dict[str, int] = {
    "Sub-Centre": 1,
    "PHC": 2,
    "Specialist Clinic": 2,
    "Maternity Centre": 2,
    "CHC": 3,
    "District Hospital": 4,
    "Medical College": 4,
}

# (item name, type, smallest facility level that normally carries it)
CATALOGUE: list[tuple[str, StockItemType, int]] = [
    ("Paracetamol", StockItemType.MEDICINE, 1),
    ("ORS sachets", StockItemType.MEDICINE, 1),
    ("Iron & Folic Acid tablets", StockItemType.MEDICINE, 1),
    ("Amoxicillin", StockItemType.MEDICINE, 2),
    ("Metformin", StockItemType.MEDICINE, 2),
    ("Amlodipine", StockItemType.MEDICINE, 2),
    ("Salbutamol inhaler", StockItemType.MEDICINE, 3),
    ("Anti-snake venom", StockItemType.MEDICINE, 4),
    ("Blood pressure check", StockItemType.DIAGNOSTIC, 1),
    ("Pregnancy test", StockItemType.DIAGNOSTIC, 1),
    ("Blood sugar (glucometer)", StockItemType.DIAGNOSTIC, 2),
    ("Haemoglobin test", StockItemType.DIAGNOSTIC, 2),
    ("Malaria rapid test", StockItemType.DIAGNOSTIC, 2),
    ("ECG", StockItemType.DIAGNOSTIC, 3),
    ("X-ray", StockItemType.DIAGNOSTIC, 3),
    ("Ultrasound", StockItemType.DIAGNOSTIC, 4),
]


def seed_facilities(db: Session) -> int:
    """Insert the facility list once. Returns the number of rows added."""
    existing = {name for (name,) in db.query(Facility.name).all()}
    added = [Facility(**row) for row in FACILITIES if row["name"] not in existing]
    if added:
        db.add_all(added)
        db.commit()
    return len(added)


def seed_stock(db: Session) -> int:
    """Give every facility its stock list once. Returns the number of rows added.

    Availability is derived rather than random so the seeded state is the same
    on every machine - a handful of items are out of stock, which is what makes
    the feature visible to a patient deciding whether to travel.
    """
    stocked_ids = {
        facility_id for (facility_id,) in db.query(FacilityStock.facility_id).distinct()
    }

    rows: list[FacilityStock] = []
    for facility in db.query(Facility).order_by(Facility.id).all():
        if facility.id in stocked_ids:
            continue

        level = FACILITY_LEVEL.get(facility.type, 2)
        for index, (item_name, item_type, needed) in enumerate(CATALOGUE):
            if needed > level:
                continue
            rows.append(
                FacilityStock(
                    facility_id=facility.id,
                    item_name=item_name,
                    item_type=item_type,
                    available=(facility.id * 3 + index) % 7 != 0,
                )
            )

    if rows:
        db.add_all(rows)
        db.commit()
    return len(rows)
