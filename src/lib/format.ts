/** Small display helpers shared by both flows. */

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
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
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
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
  if (days === 0) return "Due today";
  if (days > 0) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  const overdue = -days;
  return `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
}
