"""Background extraction for uploaded medical documents.

Reading a PDF with Gemini takes seconds to tens of seconds, so it never runs
inside the upload request. The request stores the file, returns PENDING, and
hands the document id to this module's worker pool.

A dedicated pool rather than FastAPI BackgroundTasks, for two reasons:
  - concurrency is capped, so a burst of uploads cannot exhaust a free-tier
    quota all at once;
  - it works outside a request, so documents left PENDING or PROCESSING by a
    server restart are picked up again on startup instead of hanging forever.
"""

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from app.ages import today
from app.config import settings
from app.database import SessionLocal
from app.extraction import ExtractionFailed, ExtractionNotConfigured, extract_summary
from app.models import DocumentStatus, MedicalDocument, utcnow

logger = logging.getLogger("medlink.documents")

# Two at a time keeps well inside free-tier requests-per-minute limits.
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="extract")


def submit(document_id: int) -> None:
    """Queue a document for extraction. Returns immediately."""
    _executor.submit(_safe_process, document_id)


def resume_unfinished() -> int:
    """Re-queue documents a restart left mid-flight. Returns how many."""
    with SessionLocal() as db:
        ids = [
            document_id
            for (document_id,) in db.query(MedicalDocument.id).filter(
                MedicalDocument.status.in_(
                    [DocumentStatus.PENDING, DocumentStatus.PROCESSING]
                )
            )
        ]
    for document_id in ids:
        submit(document_id)
    return len(ids)


def shutdown() -> None:
    # Unstarted work is dropped; it is still PENDING and resumes next start.
    _executor.shutdown(wait=False, cancel_futures=True)


def _safe_process(document_id: int) -> None:
    try:
        process_document(document_id)
    except Exception:  # a worker must never die silently
        logger.exception("unexpected failure processing document %s", document_id)


def process_document(document_id: int) -> None:
    """Extract one document and store the result.

    Opens its own session: this runs after the upload request has finished and
    its session is gone.
    """
    with SessionLocal() as db:
        document = db.get(MedicalDocument, document_id)
        if document is None or document.status == DocumentStatus.DONE:
            return

        document.status = DocumentStatus.PROCESSING
        db.commit()

        try:
            pdf = (settings.uploads_dir / document.file_path).read_bytes()
        except OSError:
            _fail(db, document, "The uploaded file could not be found. Please upload it again.")
            return

        try:
            result = extract_summary(pdf)
        except ExtractionNotConfigured:
            logger.error("GEMINI_API_KEY missing; document %s cannot be read", document_id)
            _fail(db, document, "Document reading is not set up on the server yet.")
            return
        except ExtractionFailed as error:
            _fail(db, document, str(error))
            return
        except Exception:
            logger.exception("extraction crashed for document %s", document_id)
            _fail(
                db,
                document,
                "Something went wrong while reading this document. Please try again.",
            )
            return

        summary = result.summary
        if not summary.is_medical_document:
            _fail(
                db,
                document,
                "This does not look like a medical record. Please upload a hospital "
                "report, prescription or discharge summary.",
            )
            return

        # What the patient typed is kept; extraction only fills the gaps.
        if not document.hospital_name_entered and summary.hospital_name:
            document.hospital_name = summary.hospital_name.strip()[:200]
        if not document.visit_date_entered:
            extracted = _parse_date(summary.visit_date)
            # A visit dated in the future is a misread, not a visit.
            if extracted is not None and extracted <= today():
                document.visit_date = extracted

        document.extracted_summary = summary.model_dump(mode="json")
        document.extraction_model = result.model
        document.status = DocumentStatus.DONE
        document.failure_reason = None
        document.processed_at = utcnow()
        db.commit()
        logger.info("document %s extracted with %s", document_id, result.model)


def _fail(db, document: MedicalDocument, reason: str) -> None:
    document.status = DocumentStatus.FAILED
    document.failure_reason = reason
    document.processed_at = utcnow()
    db.commit()


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError:
        return None
