"""The voice agent's call summaries, read from Firestore for a patient's call history.

The agent writes one document per finished call to
patients/{+91XXXXXXXXXX}/calls/{call_id} in the (default) Firestore database
(see firestore_export.py in the agent's repository). This module only reads.

Which calls belong to a patient is decided from the phone number on their
MedLink record, never from anything the client sends.
"""

import logging
import re
import threading
from typing import Any
from urllib.parse import quote

import google.auth.exceptions
import requests
from fastapi import HTTPException, status
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

from app.config import settings

logger = logging.getLogger("medlink.calls")

FIRESTORE_API = "https://firestore.googleapis.com/v1"
SCOPES = ["https://www.googleapis.com/auth/datastore"]
# One screen of history; older calls are rarely what a patient is looking for.
PAGE_SIZE = 50

_lock = threading.Lock()
_client: tuple[AuthorizedSession, str] | None = None


def firestore_phone_id(phone: str) -> str | None:
    """The agent's document id for a phone number: +91 and the last 10 digits.

    MedLink keeps the digits a patient typed, and the agent folds every Indian
    format (9876543210, +919876543210, 09876543210) to the same 10 digits, so
    both sides land on one id.
    """
    digits = re.sub(r"\D", "", phone or "")
    return f"+91{digits[-10:]}" if len(digits) >= 10 else None


def list_calls(phone: str) -> list[dict[str, Any]]:
    """Calls made from this phone number, newest first."""
    document_id = firestore_phone_id(phone)
    if document_id is None:
        return []
    body = _get(
        f"patients/{quote(document_id, safe='')}/calls",
        params={"orderBy": "started_at desc", "pageSize": PAGE_SIZE},
    )
    return [_document_data(document) for document in body.get("documents", [])]


def get_call(phone: str, call_id: str) -> dict[str, Any]:
    """One call made from this phone number."""
    document_id = firestore_phone_id(phone)
    if document_id is None:
        raise _not_found()
    # "+" must be escaped, or it is read as a space.
    return _document_data(
        _get(f"patients/{quote(document_id, safe='')}/calls/{quote(call_id, safe='')}")
    )


def _session() -> tuple[AuthorizedSession, str]:
    """An authorised session and the project id, loaded from the key file once."""
    global _client
    with _lock:
        if _client is None:
            credentials = service_account.Credentials.from_service_account_file(
                str(settings.firebase_credentials_file), scopes=SCOPES
            )
            _client = (AuthorizedSession(credentials), credentials.project_id)
        return _client


def _get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    if not settings.firebase_configured:
        raise _not_set_up()
    try:
        session, project = _session()
    except (OSError, ValueError):
        logger.exception("could not load the Firebase key file")
        raise _not_set_up() from None

    url = (
        f"{FIRESTORE_API}/projects/{project}"
        f"/databases/{settings.firestore_database}/documents/{path}"
    )
    try:
        response = session.get(url, params=params, timeout=settings.firestore_timeout_seconds)
    except (requests.RequestException, google.auth.exceptions.GoogleAuthError) as error:
        logger.warning("Firestore unreachable: %s", error)
        raise _unavailable() from error

    if response.status_code == 200:
        return response.json()
    if response.status_code in (400, 404):
        # 400 is a malformed call id, which cannot name a real call either.
        raise _not_found()
    logger.warning("Firestore read failed with HTTP %s", response.status_code)
    raise _unavailable()


def _not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, "No call summary with that id.")


def _not_set_up() -> HTTPException:
    return HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE, "Call history is not set up on the server yet."
    )


def _unavailable() -> HTTPException:
    return HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "Call history is unavailable right now. Please try again.",
    )


def _document_data(document: dict[str, Any]) -> dict[str, Any]:
    data = {key: _decode(value) for key, value in document.get("fields", {}).items()}
    # The agent stores call_id inside the document; the name is a fallback.
    data.setdefault("call_id", document.get("name", "").rsplit("/", 1)[-1])
    return data


def _decode(value: dict[str, Any]) -> Any:
    """Firestore's REST API wraps every value in its type. Unwrap it."""
    if "mapValue" in value:
        return {k: _decode(v) for k, v in value["mapValue"].get("fields", {}).items()}
    if "arrayValue" in value:
        return [_decode(v) for v in value["arrayValue"].get("values", [])]
    if "integerValue" in value:
        # Sent as a string so 64-bit values survive JSON.
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    for kind in (
        "stringValue",
        "booleanValue",
        "timestampValue",
        "referenceValue",
        "bytesValue",
        "geoPointValue",
    ):
        if kind in value:
            return value[kind]
    return None
