"""Age, computed from date of birth - never stored.

A stored age is a snapshot that is wrong a year later, and the doctor's
timeline needs the patient's age at each past visit, not today. So every age
the API returns comes from here, at request time.
"""

from dataclasses import dataclass
from datetime import date, datetime


@dataclass(frozen=True)
class ComputedAge:
    years: int
    label: str


def today() -> date:
    """The server's local calendar date (the deployment runs in IST)."""
    return datetime.now().date()


def age_on(date_of_birth: date | None, on: date) -> ComputedAge | None:
    """Age on a given date, or None when it cannot be known.

    None when there is no date of birth (patients registered before it was
    collected), or when `on` falls before the birth date - a record dated
    before someone was born is a data error, not an age.
    """
    if date_of_birth is None or on < date_of_birth:
        return None

    had_birthday = (on.month, on.day) >= (date_of_birth.month, date_of_birth.day)
    years = on.year - date_of_birth.year - (0 if had_birthday else 1)

    total_months = (on.year - date_of_birth.year) * 12 + (on.month - date_of_birth.month)
    if on.day < date_of_birth.day:
        total_months -= 1

    return ComputedAge(years=years, label=_label(years, total_months, on, date_of_birth))


def _label(years: int, total_months: int, on: date, date_of_birth: date) -> str:
    # Under two, "0 yrs" hides what a paediatric visit needs - show months.
    if years >= 2:
        return f"{years} yrs"
    if total_months >= 12:
        months = total_months - 12
        return "1 yr" if months == 0 else f"1 yr {months} mo"
    if total_months >= 1:
        return f"{total_months} mo"
    days = (on - date_of_birth).days
    return "Newborn" if days == 0 else f"{days} day{'s' if days != 1 else ''}"
