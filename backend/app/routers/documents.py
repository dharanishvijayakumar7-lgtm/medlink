"""Medical records a patient brings in from other hospitals.

Upload stores the PDF and returns PENDING at once; extraction runs in the
background (see app.document_processing). Deliberately separate from MedLink's
own record - only the doctor's timeline merges the two.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import document_processing
from app.ages import today
from app.config import settings
from app.database import get_db
from app.models import MedicalDocument
from app.queries import load_patient
from app.schemas import MedicalDocumentOut

router = APIRouter(tags=["documents"])

PDF_MAGIC = b"%PDF-"


def _optional_text(value: str | None, limit: int) -> str | None:
    """Multipart forms send empty fields as "" - treat those as not given."""
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned[:limit] if cleaned else None


def _optional_visit_date(value: str | None) -> date | None:
    cleaned = (value or "").strip()
    if not cleaned:
        return None
    try:
        parsed = date.fromisoformat(cleaned)
    except ValueError as error:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "visit_date must be YYYY-MM-DD"
        ) from error
    if parsed > today():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "visit_date cannot be in the future"
        )
    return parsed


@router.post(
    "/patients/{unique_code}/documents",
    response_model=MedicalDocumentOut,
    status_code=status.HTTP_202_ACCEPTED,
)
def upload_document(
    unique_code: str,
    file: UploadFile = File(...),
    hospital_name: str | None = Form(None),
    visit_date: str | None = Form(None),
    db: Session = Depends(get_db),
) -> MedicalDocument:
    """Store a PDF and queue it for extraction. Returns PENDING immediately."""
    patient = load_patient(db, unique_code)
    entered_hospital = _optional_text(hospital_name, 200)
    entered_date = _optional_visit_date(visit_date)

    # Read one byte past the limit so an oversized upload is caught without
    # holding more than that in memory.
    data = file.file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File is larger than {settings.max_upload_bytes // (1024 * 1024)} MB.",
        )
    # Check the bytes, not the client's claimed content type.
    if not data.startswith(PDF_MAGIC):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Please upload a PDF file."
        )

    # Never build the path from the client's filename.
    relative = f"{patient.unique_code}/{uuid.uuid4().hex}.pdf"
    target = settings.uploads_dir / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)

    document = MedicalDocument(
        patient_id=patient.id,
        hospital_name=entered_hospital,
        visit_date=entered_date,
        hospital_name_entered=entered_hospital is not None,
        visit_date_entered=entered_date is not None,
        original_filename=(file.filename or "document.pdf")[:255],
        file_path=relative,
        file_size=len(data),
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    document_processing.submit(document.id)
    return document


@router.get("/patients/{unique_code}/documents", response_model=list[MedicalDocumentOut])
def list_documents(unique_code: str, db: Session = Depends(get_db)) -> list[MedicalDocument]:
    """Every document for a patient, most recent upload first."""
    return load_patient(db, unique_code).documents


def _load_document(db: Session, document_id: int) -> MedicalDocument:
    document = db.get(MedicalDocument, document_id)
    if document is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"No document with id {document_id}"
        )
    return document


@router.get("/documents/{document_id}", response_model=MedicalDocumentOut)
def get_document(document_id: int, db: Session = Depends(get_db)) -> MedicalDocument:
    return _load_document(db, document_id)


@router.get("/documents/{document_id}/file", response_class=FileResponse)
def get_document_file(document_id: int, db: Session = Depends(get_db)) -> FileResponse:
    """The original PDF, shown inline rather than forced to download."""
    document = _load_document(db, document_id)
    path = settings.uploads_dir / document.file_path
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "The original file is missing.")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=document.original_filename,
        content_disposition_type="inline",
    )
