/** Small display helpers shared by both flows, in the app's language. */

import { currentLocale, translate } from "@/lib/i18n";

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(currentLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return translate("time.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return translate("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return translate("time.daysAgo", { count: days });
  return formatDateTime(iso);
}

/** Accepts "med 482119", "482119" or "MED-482119" and returns "MED-482119". */
export function normalisePatientCode(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 6) return `MED-${digits}`;
  return input.trim().toUpperCase();
}

// --- Plain calendar dates (YYYY-MM-DD) --------------------------------------
//
// Follow-up due dates are calendar dates, not instants: "come back on the 20th"
// means the 20th wherever the patient is. They are kept as ISO date strings end
// to end so no timezone ever shifts them by a day.

export function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** An ISO date this many days from today. */
export function isoDateInDays(days: number): string {
  const target = new Date();
  target.setDate(target.getDate() + days);
  return toIsoDate(target);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  // Rejects rolled-over dates like 2026-02-31.
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export function formatIsoDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(currentLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Negative when the date has passed. */
export function daysUntilIsoDate(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** "Due today", "Due in 5 days", "3 days overdue". */
export function describeDueDate(value: string): string {
  const days = daysUntilIsoDate(value);
  if (days === 0) return translate("due.today");
  if (days > 0) return translate("due.inDays", { count: days });
  return translate("due.overdue", { count: -days });
}

// --- Age (always computed by the server) ------------------------------------
//
// The client never works out an age: the server computes it from date of birth
// at request time and sends a label. These only choose what to show when a
// patient registered before date of birth was collected has none.

/**
 * The server's age label ("33 yrs", "1 yr 3 mo", "7 mo") in the app's
 * language. Anything it does not recognise is shown as sent.
 */
export function ageLabel(label: string): string {
  const match = /^(?:(\d+) yrs?)?\s*(?:(\d+) mo)?$/.exec(label.trim());
  if (!match || (!match[1] && !match[2])) return label;
  const parts: string[] = [];
  if (match[1]) parts.push(translate("age.years", { count: Number(match[1]) }));
  if (match[2]) parts.push(translate("age.months", { count: Number(match[2]) }));
  return parts.join(" ");
}

/** For compact rows, e.g. "33 yrs" or "Age -". */
export function ageShort(label: string | null | undefined): string {
  return label ? ageLabel(label) : translate("age.unknownShort");
}

/** For demographics, e.g. "33 yrs" or "Not provided". */
export function ageLong(label: string | null | undefined): string {
  return label ? ageLabel(label) : translate("common.notProvided");
}

const GENDERS: Record<string, string> = {
  female: "gender.female",
  male: "gender.male",
  other: "gender.other",
  unknown: "gender.unknown",
};

/** A stored language name ("Hindi") in the app's language; unknown names as sent. */
export function languageLabel(name: string): string {
  const key = `language.${name.trim().toLowerCase()}`;
  const shown = translate(key);
  return shown === key ? name : shown;
}

/** Gender is stored in English; this is only what is shown. */
export function genderLabel(gender: string): string {
  const key = GENDERS[gender.trim().toLowerCase()];
  return key ? translate(key) : gender;
}

/** "248 KB", "1.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
