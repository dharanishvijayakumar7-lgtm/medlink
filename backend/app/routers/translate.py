"""Live translation for text that only exists at run time.

The app's own screen text is translated ahead of time into src/locales. This
route covers the rest: symptom check results, document summaries and call
summaries, all of which are written in English.
"""

import logging
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app import bhashini

logger = logging.getLogger("medlink.translate")

router = APIRouter(tags=["translate"])


class TranslateRequest(BaseModel):
    texts: list[str] = Field(max_length=60)
    target: Literal["en", "hi", "ta", "te", "kn", "ml"]


class TranslateResult(BaseModel):
    texts: list[str]
    # False when the English was returned unchanged because Bhashini was not
    # available - the app keeps showing English rather than an error.
    translated: bool


@router.post("/translate", response_model=TranslateResult)
def translate_texts(payload: TranslateRequest) -> TranslateResult:
    texts = [text[:2000] for text in payload.texts]
    if payload.target == "en" or not texts:
        return TranslateResult(texts=texts, translated=payload.target == "en")
    try:
        return TranslateResult(
            texts=bhashini.translate(texts, payload.target), translated=True
        )
    except bhashini.BhashiniNotConfigured:
        return TranslateResult(texts=texts, translated=False)
    except bhashini.BhashiniFailed:
        return TranslateResult(texts=texts, translated=False)
