/**
 * Showing saved symptom check text in the app's language.
 *
 * In-app answers are saved as the English option text, which is exactly the
 * English in en.json, so they are translated from the committed files with no
 * network call. Anything else (voice-call answers, free text) is translated
 * live.
 */

import { translate } from "@/lib/i18n";
import en from "@/locales/en.json";
import { useTranslated } from "@/lib/use-translated";

const PREFIXES = ["symptom.q.", "symptom.opt.", "symptom.short."];

const KEY_BY_ENGLISH = new Map<string, string>();
for (const [key, value] of Object.entries(en)) {
  if (PREFIXES.some((prefix) => key.startsWith(prefix))) KEY_BY_ENGLISH.set(value, key);
}

/** "Fever, 1-3 days" -> translated, or null if any part is not a known option. */
export function localizeSymptomText(text: string): string | null {
  const parts = text.split(",").map((part) => part.trim());
  const keys = parts.map((part) => KEY_BY_ENGLISH.get(part));
  if (parts.length === 0 || keys.some((key) => !key)) return null;
  return keys.map((key) => translate(key!)).join(", ");
}

export function useLocalizedSymptomTexts(texts: readonly string[]): string[] {
  const known = texts.map(localizeSymptomText);
  const { texts: live } = useTranslated(texts.filter((_, index) => known[index] === null));
  let next = 0;
  return texts.map((text, index) => known[index] ?? live[next++] ?? text);
}
