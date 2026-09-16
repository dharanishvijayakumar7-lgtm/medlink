"""Text translation through Bhashini (MeitY's Indian-language AI platform).

Bhashini works in two steps:
  1. ask the pipeline config endpoint which service handles a language pair.
     It answers with a service id, an inference URL and an inference key;
  2. send the texts to that inference URL with that key.

Step 1 is cached per language pair, so normally only step 2 runs. Translated
strings are cached in memory too, so a screen opened twice costs one call.

The Bhashini keys stay on this server. The app never sees them.
"""

import logging
import re
import threading
from collections import OrderedDict
from dataclasses import dataclass

import requests

from app.config import settings

logger = logging.getLogger("medlink.bhashini")

CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"

# The app's languages. Codes are what Bhashini expects.
SUPPORTED = {"en", "hi", "ta", "te", "kn", "ml"}

_BATCH_SIZE = 20
_CONFIG_TIMEOUT = 15
_COMPUTE_TIMEOUT = 30
_CACHE_LIMIT = 5000


class BhashiniNotConfigured(RuntimeError):
    """BHASHINI_USER_ID / BHASHINI_API_KEY are missing."""


class BhashiniFailed(RuntimeError):
    """Bhashini could not be reached or returned something unusable."""


@dataclass(frozen=True)
class _Pipeline:
    service_id: str
    url: str
    key_name: str
    key_value: str


_pipelines: dict[tuple[str, str], _Pipeline] = {}
_cache: OrderedDict[tuple[str, str, str], str] = OrderedDict()
_lock = threading.Lock()


def _task(source: str, target: str) -> dict:
    return {
        "taskType": "translation",
        "config": {"language": {"sourceLanguage": source, "targetLanguage": target}},
    }


def _pipeline(source: str, target: str) -> _Pipeline:
    with _lock:
        cached = _pipelines.get((source, target))
    if cached:
        return cached

    try:
        response = requests.post(
            CONFIG_URL,
            headers={
                "userID": settings.bhashini_user_id,
                "ulcaApiKey": settings.bhashini_api_key,
            },
            json={
                "pipelineTasks": [_task(source, target)],
                "pipelineRequestConfig": {"pipelineId": settings.bhashini_pipeline_id},
            },
            timeout=_CONFIG_TIMEOUT,
        )
        response.raise_for_status()
        body = response.json()
        service_id = body["pipelineResponseConfig"][0]["config"][0]["serviceId"]
        endpoint = body["pipelineInferenceAPIEndPoint"]
        pipeline = _Pipeline(
            service_id=service_id,
            url=endpoint["callbackUrl"],
            key_name=endpoint["inferenceApiKey"]["name"],
            key_value=endpoint["inferenceApiKey"]["value"],
        )
    except requests.HTTPError as error:
        # The body explains auth problems; it never contains our key.
        logger.error(
            "Bhashini pipeline config %s->%s failed: %s %s",
            source, target, error.response.status_code, error.response.text[:300],
        )
        raise BhashiniFailed("Bhashini rejected the pipeline config request") from error
    except (requests.RequestException, KeyError, IndexError, TypeError, ValueError) as error:
        logger.error("Bhashini pipeline config %s->%s failed: %r", source, target, error)
        raise BhashiniFailed("Bhashini pipeline config was unusable") from error

    with _lock:
        _pipelines[(source, target)] = pipeline
    return pipeline


def _compute(pipeline: _Pipeline, source: str, target: str, texts: list[str]) -> list[str]:
    task = _task(source, target)
    task["config"]["serviceId"] = pipeline.service_id
    try:
        response = requests.post(
            pipeline.url,
            headers={pipeline.key_name: pipeline.key_value},
            json={
                "pipelineTasks": [task],
                "inputData": {"input": [{"source": text} for text in texts]},
            },
            timeout=_COMPUTE_TIMEOUT,
        )
        response.raise_for_status()
        output = response.json()["pipelineResponse"][0]["output"]
        translated = [item["target"] for item in output]
    except requests.HTTPError as error:
        if error.response.status_code in (401, 403):
            # The cached inference key may have been rotated; fetch it again next time.
            with _lock:
                _pipelines.pop((source, target), None)
        logger.error(
            "Bhashini translation %s->%s failed: %s %s",
            source, target, error.response.status_code, error.response.text[:300],
        )
        raise BhashiniFailed("Bhashini rejected the translation request") from error
    except (requests.RequestException, KeyError, IndexError, TypeError, ValueError) as error:
        logger.error("Bhashini translation %s->%s failed: %r", source, target, error)
        raise BhashiniFailed("Bhashini translation was unusable") from error

    if len(translated) != len(texts):
        raise BhashiniFailed("Bhashini returned a different number of texts")
    return translated


def translate(texts: list[str], target: str, source: str = "en") -> list[str]:
    """Translate ``texts`` in order. Blank strings pass through unchanged."""
    if source == target:
        return list(texts)
    if not settings.bhashini_configured:
        raise BhashiniNotConfigured("BHASHINI_USER_ID / BHASHINI_API_KEY are not set.")
    if source not in SUPPORTED or target not in SUPPORTED:
        raise ValueError(f"unsupported language pair {source}->{target}")

    result: list[str | None] = [None] * len(texts)
    missing: dict[str, list[int]] = {}
    with _lock:
        for index, text in enumerate(texts):
            if not text.strip():
                result[index] = text
                continue
            hit = _cache.get((source, target, text))
            if hit is not None:
                _cache.move_to_end((source, target, text))
                result[index] = hit
            else:
                missing.setdefault(text, []).append(index)

    if missing:
        pipeline = _pipeline(source, target)
        unique = list(missing)
        for start in range(0, len(unique), _BATCH_SIZE):
            batch = unique[start : start + _BATCH_SIZE]
            translated = [
                _fix_colons(original, output, target)
                for original, output in zip(batch, _compute(pipeline, source, target, batch))
            ]
            with _lock:
                for original, output in zip(batch, translated):
                    _cache[(source, target, original)] = output
                    while len(_cache) > _CACHE_LIMIT:
                        _cache.popitem(last=False)
            for original, output in zip(batch, translated):
                for index in missing[original]:
                    result[index] = output

    return [text if text is not None else "" for text in result]


# Hindi, Telugu, Kannada and Malayalam output sometimes writes a colon as the
# visarga sign, which looks like one but is a letter. Tamil's aytham is a real
# letter in normal words, so Tamil is left alone.
_VISARGA = {"hi": "ः", "te": "ః", "kn": "ಃ", "ml": "ഃ"}


def _fix_colons(source: str, output: str, target: str) -> str:
    visarga = _VISARGA.get(target)
    lost = source.count(":") - output.count(":")
    if not visarga or lost <= 0:
        return output
    # Only a visarga that ends a word; words such as "पुनः" keep theirs.
    return re.sub(rf"{visarga}(?=\s|$)", ":", output, count=lost)


# --- Placeholders -------------------------------------------------------------
#
# App strings carry placeholders such as "{count}", and text a person must type
# exactly as shown ("MED-482119", "YYYY-MM-DD"). A translation model may
# translate or re-spell them, so they are swapped for plain numbers first -
# numbers come through translation intact - and swapped back afterwards.

_PLACEHOLDER = re.compile(r"\{\w+\}|MED-\d*|YYYY-MM-DD|npx expo run:android")
# Indic scripts have their own digits; the model sometimes answers with them.
_NATIVE_DIGITS = str.maketrans(
    "०१२३४५६७८९௦௧௨௩௪௫௬௭௮௯౦౧౨౩౪౫౬౭౮౯೦೧೨೩೪೫೬೭೮೯൦൧൨൩൪൫൬൭൮൯",
    "0123456789" * 5,
)
_TOKEN_BASE = 7301


def protect(text: str) -> tuple[str, list[str]]:
    names = _PLACEHOLDER.findall(text)
    for position, name in enumerate(names):
        text = text.replace(name, str(_TOKEN_BASE + position), 1)
    return text, names


def restore(text: str, names: list[str]) -> str | None:
    """Put placeholders and literals back. None if any did not survive translation."""
    text = text.translate(_NATIVE_DIGITS)
    for position, name in enumerate(names):
        token = str(_TOKEN_BASE + position)
        if text.count(token) != 1:
            return None
        text = text.replace(token, name)
    return text
