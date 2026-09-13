"""The doctor's merged history of a patient.

Uploaded records from other hospitals and MedLink's own events (triage, notes,
referrals) in one chronological list, oldest first, each carrying the patient's
age on that date. The point is the whole picture in one scroll, so the doctor
does not re-interview the patient from zero.
"""

from datetime import date, datetime, time

from app.ages import age_on
from app.models import DocumentStatus, MedicalDocument, Patient
from app.schemas import (
    ConsultationNoteOut,
    MedicalDocumentOut,
    PatientOut,
    PatientTimeline,
    ReferralOut,
    TimelineEntry,
    TriageEntryOut,
)

MEDLINK = "MedLink"


def _local_date(moment: datetime) -> date:
    """Timestamps are stored in UTC; a visit happens on a local calendar day."""
    return moment.astimezone().date()


def _truncate(text: str, limit: int = 90) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _document_title(document: MedicalDocument) -> str:
    if document.status == DocumentStatus.FAILED:
        return "Uploaded record could not be read"
    if document.status != DocumentStatus.DONE or not document.extracted_summary:
        return "Uploaded record is still being analysed"
    summary = document.extracted_summary
    symptoms = [s for s in summary.get("symptoms") or [] if s]
    if symptoms:
        return _truncate(", ".join(symptoms[:3]).capitalize())
    return _truncate(summary.get("plain_summary") or "Uploaded medical record")


def build_timeline(patient: Patient) -> PatientTimeline:
    # (sort date, tie-break moment, entry). The tie-break keeps same-day events
    # in the order they happened; an outside visit sorts before MedLink events
    # on the same day, since it is placed at the start of that day.
    rows: list[tuple[date, datetime, TimelineEntry]] = []
    dob = patient.date_of_birth

    def age_fields(on: date, estimated: bool) -> dict:
        # No age for an estimated date: the upload date is not the visit date,
        # and an age computed from it would look accurate while being wrong.
        computed = None if estimated else age_on(dob, on)
        return {
            "age_at_date": computed.years if computed else None,
            "age_at_date_label": computed.label if computed else None,
        }

    for document in patient.documents:
        estimated = document.visit_date is None
        on = _local_date(document.uploaded_at) if estimated else document.visit_date
        moment = (
            document.uploaded_at
            if estimated
            else datetime.combine(on, time.min).astimezone()
        )
        rows.append(
            (
                on,
                moment,
                TimelineEntry(
                    kind="document",
                    date=on,
                    date_is_estimated=estimated,
                    source=document.hospital_name or "Hospital not named",
                    title=_document_title(document),
                    document=MedicalDocumentOut.model_validate(document),
                    **age_fields(on, estimated),
                ),
            )
        )

    for entry in patient.triage_entries:
        on = _local_date(entry.created_at)
        rows.append(
            (
                on,
                entry.created_at,
                TimelineEntry(
                    kind="triage",
                    date=on,
                    date_is_estimated=False,
                    source=MEDLINK,
                    title=_truncate(entry.summary),
                    triage=TriageEntryOut.model_validate(entry),
                    **age_fields(on, False),
                ),
            )
        )

    for note in patient.notes:
        on = _local_date(note.created_at)
        rows.append(
            (
                on,
                note.created_at,
                TimelineEntry(
                    kind="note",
                    date=on,
                    date_is_estimated=False,
                    source=MEDLINK,
                    title=_truncate(f"Dr. {note.doctor.name}: {note.note_text}"),
                    note=ConsultationNoteOut.model_validate(note),
                    **age_fields(on, False),
                ),
            )
        )

    for referral in patient.referrals:
        on = _local_date(referral.created_at)
        rows.append(
            (
                on,
                referral.created_at,
                TimelineEntry(
                    kind="referral",
                    date=on,
                    date_is_estimated=False,
                    source=MEDLINK,
                    title=_truncate(
                        f"Referred to {referral.to_facility.name} - "
                        f"{referral.status.replace('_', ' ').lower()}"
                    ),
                    referral=ReferralOut.model_validate(referral),
                    **age_fields(on, False),
                ),
            )
        )

    rows.sort(key=lambda row: (row[0], row[1]))
    return PatientTimeline(
        patient=PatientOut.model_validate(patient),
        entries=[entry for _, _, entry in rows],
    )
