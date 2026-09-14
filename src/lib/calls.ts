/** Display helpers for the voice agent's call summaries. */

import type { Tone } from "@/components/ui";
import type { CallSummary } from "@/lib/api";

/**
 * Urgency the agent assessed. Red only for an emergency - DESIGN.md reserves
 * it for life-threatening events; every other alert is amber.
 */
export function urgencyMeta(
  urgency: CallSummary["urgency"],
): { label: string; tone: Tone } | null {
  switch (urgency) {
    case "emergency":
      return { label: "EMERGENCY", tone: "emergency" };
    case "urgent":
      return { label: "URGENT", tone: "warning" };
    case "clinic":
      return { label: "VISIT A CLINIC", tone: "warning" };
    case "self_care":
      return { label: "SELF-CARE", tone: "success" };
    default:
      return null;
  }
}

/** "Under a minute", "4 min". */
export function formatCallDuration(seconds: number | null | undefined): string | null {
  if (seconds == null) return null;
  if (seconds < 60) return "Under a minute";
  return `${Math.round(seconds / 60)} min`;
}

const LANGUAGES: Record<string, string> = {
  "en-IN": "English",
  "hi-IN": "Hindi",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
  "kn-IN": "Kannada",
  "ml-IN": "Malayalam",
};

export function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  return LANGUAGES[code] ?? code;
}

/** How the call reached the agent: a phone line, the web, or a test console. */
export function channelLabel(channel: string | null | undefined): string {
  switch (channel) {
    case "pstn":
      return "Phone call";
    case "web":
      return "Web call";
    case "console":
      return "Test call";
    default:
      return "Call";
  }
}

const ANSWER_LABELS: Record<string, string> = {
  duration: "How long",
  severity: "How bad",
  location: "Where",
  onset: "How it started",
  associated: "Other symptoms",
  history: "Past history",
};

export function answerLabel(slot: string): string {
  return ANSWER_LABELS[slot] ?? slot.charAt(0).toUpperCase() + slot.slice(1);
}

/** Shown with every call summary, so no screen can present one as a diagnosis. */
export const CALL_DISCLAIMER =
  "This summary was made from what you said on the call. It is not a diagnosis " +
  "and it may contain mistakes. Talk to a doctor before acting on it.";
