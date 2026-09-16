"""Fill the app's translation files from src/locales/en.json through Bhashini.

Run from backend/:

    .venv/Scripts/python.exe -m scripts.translate_locales            # missing keys, all languages
    .venv/Scripts/python.exe -m scripts.translate_locales --lang ta  # one language
    .venv/Scripts/python.exe -m scripts.translate_locales --keys symptom.title,common.back
    .venv/Scripts/python.exe -m scripts.translate_locales --force    # everything again

After changing an English string, pass its key with --keys so every language
is translated again. Keys missing from a language fall back to English in the
app, so a failed line is never shown broken.

Machine translation of health text should be read by a native speaker before
real patients use it.
"""

import argparse
import json
import sys
from pathlib import Path

from app import bhashini
from app.config import BACKEND_DIR, settings

LOCALES_DIR = BACKEND_DIR.parent / "src" / "locales"
TARGETS = ["hi", "ta", "te", "kn", "ml"]


def _load(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, data: dict[str, str]) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def translate_language(
    lang: str, english: dict[str, str], force: bool, keys: set[str] | None
) -> list[str]:
    """Update one language file. Returns keys whose placeholders broke."""
    path = LOCALES_DIR / f"{lang}.json"
    existing = _load(path)

    todo = [
        key
        for key in english
        if force or key not in existing or (keys is not None and key in keys)
    ]
    print(f"{lang}: {len(todo)} to translate", flush=True)

    protected = [bhashini.protect(english[key]) for key in todo]
    translated = bhashini.translate([text for text, _ in protected], lang) if todo else []

    broken: list[str] = []
    for key, (_, names), output in zip(todo, protected, translated):
        restored = bhashini.restore(output, names)
        if restored is None or not restored.strip():
            broken.append(key)
            existing.pop(key, None)  # falls back to English in the app
        else:
            existing[key] = restored.strip()

    # Same order as en.json, and nothing en.json no longer has.
    _write(path, {key: existing[key] for key in english if key in existing})
    return broken


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--lang", action="append", choices=TARGETS)
    parser.add_argument("--keys", help="comma-separated keys to translate again")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if not settings.bhashini_configured:
        print("Set BHASHINI_USER_ID and BHASHINI_API_KEY in backend/.env first.")
        return 1

    english = _load(LOCALES_DIR / "en.json")
    keys = {key.strip() for key in args.keys.split(",")} if args.keys else None
    if keys and (unknown := keys - english.keys()):
        print("Not in en.json:", ", ".join(sorted(unknown)))
        return 1

    failed = False
    for lang in args.lang or TARGETS:
        try:
            broken = translate_language(lang, english, args.force, keys)
        except bhashini.BhashiniFailed as error:
            print(f"{lang}: Bhashini failed ({error}); see the log above. File left as it was.")
            failed = True
            continue
        if broken:
            failed = True
            print(f"{lang}: {len(broken)} line(s) lost a placeholder and stay English:")
            for key in broken:
                print(f"    {key}: {english[key]}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
