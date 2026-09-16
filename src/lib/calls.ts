/** Display helpers for the voice agent's call summaries. */

import type { Tone } from "@/components/ui";
import type { CallSummary } from "@/lib/api";
import { translate } from "@/lib/i18n";

/**
 * Urgency the agent assessed. Red only for an emergency - DESIGN.md reserves
 * it for life-threatening events; every other alert is amber.
 */
export function urgencyMeta(
  urgency: CallSummary["urgency"],
): { label: string; tone: Tone } | null {
  switch (urgency) {
    case "emergency":
      return { label: translate("call.urgency.emergency"), tone: "emergency" };
    case "urgent":
      return { label: translate("call.urgency.urgent"), tone: "warning" };
    case "clinic":
      return { label: translate("call.urgency.clinic"), tone: "warning" };
    case "self_care":
      return { label: translate("call.urgency.selfCare"), tone: "success" };
    default:
      return null;
  }
}

/** "Under a minute", "4 min". */
export function formatCallDuration(seconds: number | null | undefined): string | null {
  if (seconds == null) return null;
  if (seconds < 60) return translate("call.underMinute");
  return translate("call.minutes", { count: Math.round(seconds / 60) });
}

const LANGUAGES: Record<string, string> = {
  "en-IN": "language.english",
  "hi-IN": "language.hindi",
  "ta-IN": "language.tamil",
  "te-IN": "language.telugu",
  "kn-IN": "language.kannada",
  "ml-IN": "language.malayalam",
};

export function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  return LANGUAGES[code] ? translate(LANGUAGES[code]) : code;
}

/** How the call reached the agent: a phone line, the web, or a test console. */
export function channelLabel(channel: string | null | undefined): string {
  switch (channel) {
    case "pstn":
      return translate("call.channel.phone");
    case "web":
      return translate("call.channel.web");
    case "console":
      return translate("call.channel.test");
    default:
      return translate("call.channel.other");
  }
}

const ANSWER_LABELS: Record<string, string> = {
  duration: "call.answer.duration",
  severity: "call.answer.severity",
  location: "call.answer.location",
  onset: "call.answer.onset",
  associated: "call.answer.associated",
  history: "call.answer.history",
};

export function answerLabel(slot: string): string {
  const key = ANSWER_LABELS[slot];
  return key ? translate(key) : slot.charAt(0).toUpperCase() + slot.slice(1);
}

/** Shown with every call summary, so no screen can present one as a diagnosis. */
export function callDisclaimer(): string {
  return translate("call.disclaimer");
}
