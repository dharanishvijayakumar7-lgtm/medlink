"""One structured Gemini call with model fallback, shared by every Gemini task.

Tries the primary model first and moves to the fallback only when the primary
is rate-limited or temporarily unavailable, so a free-tier quota running out
degrades to a lighter model instead of failing the request.
"""

import logging
from dataclasses import dataclass
from typing import Generic, TypeVar

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger("medlink.gemini")

SchemaT = TypeVar("SchemaT", bound=BaseModel)


class GeminiNotConfigured(RuntimeError):
    """GEMINI_API_KEY is missing."""


class GeminiFailed(RuntimeError):
    """Every configured model failed."""


@dataclass
class GeminiResult(Generic[SchemaT]):
    parsed: SchemaT
    model: str


# Quota exhaustion - worth retrying on the next model rather than giving up.
_RETRYABLE_STATUS = {429, 500, 503, 504}


def _models() -> list[str]:
    ordered = [settings.gemini_model, settings.gemini_fallback_model]
    return [m for i, m in enumerate(ordered) if m and m not in ordered[:i]]


def generate_json(
    *,
    system_instruction: str,
    contents: list,
    schema: type[SchemaT],
    task: str,
    timeout_seconds: float | None = None,
) -> GeminiResult[SchemaT]:
    """Ask Gemini for JSON matching ``schema``. ``task`` only labels log lines."""
    if not settings.gemini_configured:
        raise GeminiNotConfigured("GEMINI_API_KEY is not set in backend/.env.")

    client = genai.Client(api_key=settings.gemini_api_key)
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json",
        response_schema=schema,
        temperature=0.1,
        # No tools are involved; switching this off also silences the SDK's
        # automatic-function-calling warning on every request.
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        http_options=(
            types.HttpOptions(timeout=int(timeout_seconds * 1000))
            if timeout_seconds
            else None
        ),
    )

    last_error: Exception | None = None
    for model in _models():
        try:
            response = client.models.generate_content(
                model=model, contents=contents, config=config
            )
        except genai_errors.APIError as error:
            last_error = error
            if error.code in _RETRYABLE_STATUS:
                logger.warning("%s on %s unavailable (%s), trying next", task, model, error.code)
                continue
            logger.error("%s on %s rejected: %s", task, model, error.code)
            break
        except Exception as error:  # timeouts and network errors
            last_error = error
            logger.warning("%s on %s failed (%s), trying next", task, model, error)
            continue

        parsed = response.parsed
        if isinstance(parsed, schema):
            return GeminiResult(parsed=parsed, model=model)

        # Structured output normally parses; fall back to validating the text.
        try:
            return GeminiResult(
                parsed=schema.model_validate_json(response.text or ""), model=model
            )
        except ValueError as error:
            last_error = error
            logger.error("%s on %s returned unparseable output", task, model)
            continue

    raise GeminiFailed(f"{task} failed on every model") from last_error
