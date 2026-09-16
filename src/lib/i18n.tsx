/**
 * App language: the picker on role select, and the `t()` every screen uses.
 *
 * Screen text lives in src/locales/<code>.json. en.json is the source; the
 * other files are generated once through Bhashini by
 * backend/scripts/translate_locales.py and committed, so switching language is
 * instant and works offline. Text that only exists at run time (Gemini results,
 * call summaries) is translated live instead - see @/lib/use-translated.
 *
 * Only what is shown is translated. Values that are saved or sent to the
 * server (symptom answers, gender, preferred language) stay in English so the
 * doctor queue and Gemini always read English.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import en from "@/locales/en.json";
import hi from "@/locales/hi.json";
import kn from "@/locales/kn.json";
import ml from "@/locales/ml.json";
import ta from "@/locales/ta.json";
import te from "@/locales/te.json";
import { loadLanguage, saveLanguage } from "@/lib/storage";

export const LANGUAGES = [
  { code: "en", native: "English", english: "English", locale: "en-IN" },
  { code: "hi", native: "हिन्दी", english: "Hindi", locale: "hi-IN" },
  { code: "ta", native: "தமிழ்", english: "Tamil", locale: "ta-IN" },
  { code: "te", native: "తెలుగు", english: "Telugu", locale: "te-IN" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", locale: "kn-IN" },
  { code: "ml", native: "മലയാളം", english: "Malayalam", locale: "ml-IN" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];
export type Language = (typeof LANGUAGES)[number];

type Dictionary = Record<string, string>;

const DICTIONARIES: Record<LanguageCode, Dictionary> = { en, hi, ta, te, kn, ml };

export type TranslationKey = keyof typeof en;
type Vars = Record<string, string | number>;

function isLanguageCode(value: string | null): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}

export function languageInfo(code: LanguageCode): Language {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}

// Mirrors the provider's state for code outside React (the API client, date
// helpers). Only the provider writes it.
let current: LanguageCode = "en";

export function currentLanguage(): LanguageCode {
  return current;
}

export function currentLocale(): string {
  return languageInfo(current).locale;
}

/**
 * Look a key up in the current language, falling back to English.
 *
 * `{name}` placeholders are filled from `vars`. When `vars.count` is given,
 * `<key>_one` is used for 1 and `<key>_other` otherwise, if they exist.
 */
export function translate(key: TranslationKey | string, vars?: Vars): string {
  return translateIn(current, key, vars);
}

export function isSupportedLanguage(value: string | null | undefined): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}

/**
 * `translate` in a given language rather than the app's - for text that must
 * match something else, such as a voice check answered in another language.
 */
export function translateIn(
  language: LanguageCode,
  key: TranslationKey | string,
  vars?: Vars,
): string {
  const dictionary = DICTIONARIES[language];
  let lookup = key as string;
  if (vars && typeof vars.count === "number") {
    const plural = `${key}_${vars.count === 1 ? "one" : "other"}`;
    if (plural in en) lookup = plural;
  }
  const template =
    dictionary[lookup] ?? (en as Dictionary)[lookup] ?? (lookup as string);
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

type LanguageValue = {
  language: LanguageCode;
  /** BCP 47 tag for dates, e.g. "ta-IN". */
  locale: string;
  setLanguage: (code: LanguageCode) => Promise<void>;
  t: typeof translate;
};

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadLanguage().then((stored) => {
      if (!active) return;
      if (isLanguageCode(stored)) {
        current = stored;
        setLanguageState(stored);
      }
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (code: LanguageCode) => {
    current = code;
    setLanguageState(code);
    await saveLanguage(code).catch(() => undefined);
  }, []);

  // A new `t` per language, so memoised screens re-render when it changes.
  const t = useCallback<typeof translate>(
    (key, vars) => translate(key, vars),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  );

  const value = useMemo(
    () => ({ language, locale: languageInfo(language).locale, setLanguage, t }),
    [language, setLanguage, t],
  );

  // The stored choice is read in a few milliseconds; waiting for it avoids a
  // flash of English on every launch.
  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useT(): LanguageValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useT must be used inside LanguageProvider");
  return value;
}
