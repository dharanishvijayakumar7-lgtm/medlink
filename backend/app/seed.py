"""Static seed data.

Part 1 ships a fixed facility list; a live OpenStreetMap/Overpass lookup can
replace this later without changing the API shape.
"""

from sqlalchemy.orm import Session

from app.models import Facility

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


def seed_facilities(db: Session) -> int:
    """Insert the facility list once. Returns the number of rows added."""
    existing = {name for (name,) in db.query(Facility.name).all()}
    added = [Facility(**row) for row in FACILITIES if row["name"] not in existing]
    if added:
        db.add_all(added)
        db.commit()
    return len(added)
