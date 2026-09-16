/**
 * The spoken symptom check: hold the button, say how you feel, let go.
 *
 * The microphone is read as raw 16 kHz PCM (expo-audio's stream) and wrapped
 * in a WAV here, because Android's recorder cannot write WAV and Bhashini
 * reads WAV reliably. The server transcribes it with Bhashini, writes the
 * guidance, and saves it as a normal symptom check for the doctor.
 */

import {
  type AudioStreamBuffer,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  useAudioStream,
} from "expo-audio";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { DocumentDisclaimer } from "@/components/document-disclaimer";
import { Icon } from "@/components/icon";
import { Button, Card, ChoiceChips, ErrorBanner, SectionTitle } from "@/components/ui";
import { api, ApiError, TriageEntry, TriageUrgency } from "@/lib/api";
import {
  isSupportedLanguage,
  LanguageCode,
  LANGUAGES,
  languageInfo,
  translate,
  TranslationKey,
  translateIn,
  useT,
} from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";
import { regroup, useTranslated } from "@/lib/use-translated";

const SAMPLE_RATE = 16000;
const MIN_MS = 1000;
/** Long enough to describe a problem; keeps the upload small. */
const MAX_MS = 60_000;

/** 16-bit mono PCM chunks -> a WAV file. */
function toWav(chunks: Uint8Array[], sampleRate: number): Uint8Array {
  const dataLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const wav = new Uint8Array(44 + dataLength);
  const view = new DataView(wav.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) wav[offset + i] = text.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per frame
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (const chunk of chunks) {
    wav.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return wav;
}

function clock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type Phase = "idle" | "recording" | "sending";

/** The hold-to-speak card shown at the top of the symptom check. */
export function VoiceSymptomInput({ onResult }: { onResult: (entry: TriageEntry) => void }) {
  const { t, language: appLanguage } = useT();
  const { session } = usePatientSession();
  const [spoken, setSpoken] = useState<string>(appLanguage);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const chunks = useRef<Uint8Array[]>([]);
  const rate = useRef(SAMPLE_RATE);
  const startedAt = useRef(0);
  const holding = useRef(false);
  const streaming = useRef(false);

  const { stream } = useAudioStream({
    sampleRate: SAMPLE_RATE,
    channels: 1,
    encoding: "int16",
    onBuffer: (buffer: AudioStreamBuffer) => {
      if (!streaming.current) return;
      rate.current = buffer.sampleRate;
      // Copy: the native buffer is not ours to keep.
      chunks.current.push(new Uint8Array(buffer.data).slice());
    },
  });

  async function begin() {
    if (phase !== "idle" || !session) return;
    setError(null);
    holding.current = true;

    const permission = await getRecordingPermissionsAsync();
    if (!permission.granted) {
      holding.current = false;
      const asked = await requestRecordingPermissionsAsync();
      // The press that opened the dialog is gone; the next hold records.
      if (!asked.granted) setError(t("voice.permission"));
      return;
    }

    chunks.current = [];
    rate.current = SAMPLE_RATE;
    try {
      streaming.current = true;
      await stream.start();
    } catch {
      streaming.current = false;
      holding.current = false;
      setError(t("voice.micFailed"));
      return;
    }
    startedAt.current = Date.now();
    setElapsed(0);
    setPhase("recording");
    // Let go before the microphone was ready.
    if (!holding.current) finish();
  }

  function release() {
    holding.current = false;
    if (streaming.current && startedAt.current) finish();
  }

  async function finish() {
    if (!streaming.current) return;
    streaming.current = false;
    stream.stop();
    const duration = Date.now() - startedAt.current;
    startedAt.current = 0;

    if (duration < MIN_MS || chunks.current.length === 0) {
      setPhase("idle");
      setError(t("voice.tooShort"));
      return;
    }

    setPhase("sending");
    try {
      const wav = toWav(chunks.current, rate.current);
      chunks.current = [];
      onResult(await api.addVoiceTriage(session!.unique_code, wav, spoken));
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(
          caught.status === 422 || caught.status === 413
            ? t("voice.notHeard")
            : caught.status >= 500
              ? t("voice.unavailable")
              : caught.message,
        );
      } else {
        setError(caught instanceof Error ? caught.message : t("common.somethingWrong"));
      }
    } finally {
      setPhase((current) => (current === "sending" ? "idle" : current));
    }
  }

  // The clock, and the one-minute limit.
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= MAX_MS) finish();
    }, 250);
    return () => clearInterval(timer);
    // finish reads refs only; restarting the timer on every render is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Never leave the microphone on when the screen goes away.
  useEffect(() => {
    return () => {
      if (streaming.current) {
        streaming.current = false;
        stream.stop();
      }
    };
  }, [stream]);

  const recording = phase === "recording";
  const sending = phase === "sending";

  return (
    <Card style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.headIcon}>
          <Icon name="record_voice_over" size={26} color={colors.patient} />
        </View>
        <View style={styles.headBody}>
          <Text style={styles.title}>{t("voice.title")}</Text>
          <Text style={styles.body}>{t("voice.body")}</Text>
        </View>
      </View>

      <ChoiceChips
        label={t("voice.speakIn")}
        options={LANGUAGES.map((option) => option.code)}
        value={spoken}
        onChange={(code) => (phase === "idle" ? setSpoken(code) : undefined)}
        optionLabel={(code) => languageInfo(code as (typeof LANGUAGES)[number]["code"]).native}
      />

      {error ? <ErrorBanner message={error} /> : null}

      {sending ? (
        <View style={styles.sending} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={colors.patient} />
          <Text style={styles.sendingTitle}>{t("voice.sending")}</Text>
          <Text style={styles.sendingHint}>{t("voice.sendingHint")}</Text>
        </View>
      ) : (
        <View style={styles.micArea}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("voice.hold")}
            accessibilityHint={t("voice.body")}
            onPressIn={begin}
            onPressOut={release}
            // A small finger slide must not end the recording or scroll the page.
            cancelable={false}
            pressRetentionOffset={{ top: 200, bottom: 200, left: 200, right: 200 }}
            style={[styles.mic, recording && styles.micOn]}
          >
            <Icon name={recording ? "graphic_eq" : "mic"} size={56} color={colors.onPatient} />
          </Pressable>
          <Text style={[styles.micLabel, recording && styles.micLabelOn]}>
            {recording ? `${t("voice.listening")}  ${clock(elapsed)}` : t("voice.hold")}
          </Text>
        </View>
      )}
    </Card>
  );
}

// --- Result ---------------------------------------------------------------------

const URGENCY: Record<
  TriageUrgency,
  { icon: string; title: TranslationKey; body: TranslationKey; background: string; foreground: string }
> = {
  // Red is reserved for this one case (DESIGN.md).
  EMERGENCY: {
    icon: "emergency",
    title: "symptom.result.emergencyTitle",
    body: "symptom.result.emergencyBody",
    background: colors.emergency,
    foreground: colors.onEmergency,
  },
  SEE_DOCTOR_SOON: {
    icon: "medical_services",
    title: "symptom.result.soonTitle",
    body: "symptom.result.soonBody",
    background: colors.warning,
    foreground: colors.onWarning,
  },
  HOME_CARE: {
    icon: "home",
    title: "symptom.result.homeTitle",
    body: "symptom.result.homeBody",
    background: colors.success,
    foreground: colors.onSuccess,
  },
};

function Bullets({ items, icon, color }: { items: string[]; icon: string; color: string }) {
  return (
    <View style={styles.bullets}>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletRow}>
          <Icon name={icon} size={22} color={color} style={styles.bulletIcon} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The language a voice result is shown in: the one the patient spoke, so a
 * Tamil speaker reads the answer in Tamil whatever the app is set to.
 */
export function voiceResultLanguage(entry: TriageEntry, fallback: LanguageCode): LanguageCode {
  const spoken = entry.assessment?.transcript_language;
  return isSupportedLanguage(spoken) ? spoken : fallback;
}

/** `t`, but in the language of a voice result. */
export function voiceResultT(entry: TriageEntry, fallback: LanguageCode): typeof translate {
  const language = voiceResultLanguage(entry, fallback);
  return (key, vars) => translateIn(language, key, vars);
}

/** What the patient sees after speaking: what was heard, and what to do. */
export function VoiceResult({ entry }: { entry: TriageEntry }) {
  const router = useRouter();
  const { language: appLanguage } = useT();
  const shownIn = voiceResultLanguage(entry, appLanguage);
  const t = voiceResultT(entry, appLanguage);
  const assessment = entry.assessment!;
  const level = URGENCY[assessment.urgency];

  const causes = assessment.causes ?? [];
  const keywords = assessment.keywords ?? [];
  const notToDo = assessment.what_not_to_do ?? [];

  // Written in English by the server; translated here as one batch.
  const sections = [
    [assessment.plain_summary],
    keywords,
    causes.map((cause) => cause.name),
    causes.map((cause) => cause.why),
    assessment.what_to_do,
    notToDo,
    assessment.danger_signs,
    assessment.red_flags,
  ];
  const { texts, pending } = useTranslated(sections.flat(), shownIn);
  const [[summary], shownKeywords, causeNames, causeWhys, toDo, shownNotToDo, danger, redFlags] =
    regroup(texts, sections.map((section) => section.length));

  return (
    <>
      <View style={[styles.urgency, { backgroundColor: level.background }]} accessibilityRole="alert">
        <Icon name={level.icon} size={40} color={level.foreground} />
        <View style={styles.urgencyBody}>
          <Text style={[styles.urgencyTitle, { color: level.foreground }]}>{t(level.title)}</Text>
          <Text style={[styles.urgencyText, { color: level.foreground }]}>{t(level.body)}</Text>
        </View>
      </View>

      {assessment.urgency === "EMERGENCY" ? (
        <View style={styles.actions}>
          <Button
            title={t("symptom.result.sos")}
            icon="emergency"
            tone="emergency"
            onPress={() => router.push("/patient/sos")}
          />
          <Button
            title={t("symptom.result.findHospital")}
            icon="local_hospital"
            tone="patient"
            variant="outline"
            onPress={() => router.push("/patient/facilities")}
          />
        </View>
      ) : null}

      {pending ? <Text style={styles.translating}>{t("common.translating")}</Text> : null}

      <Card style={styles.resultCard}>
        <SectionTitle>{t("voice.youSaid")}</SectionTitle>
        {assessment.transcript ? (
          <View style={styles.quote}>
            <Icon name="format_quote" size={22} color={colors.patient} />
            <Text style={styles.quoteText}>{assessment.transcript}</Text>
          </View>
        ) : null}
        {shownKeywords.length > 0 ? (
          <View style={styles.keywordRow}>
            {shownKeywords.map((keyword, index) => (
              <View key={index} style={styles.keyword}>
                <Text style={styles.keywordText}>{keyword}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.summary}>{summary}</Text>
        {redFlags.length > 0 ? (
          <Text style={styles.redFlags}>
            {t("symptom.result.because", { reasons: redFlags.join(", ") })}
          </Text>
        ) : null}
      </Card>

      {causes.length > 0 ? (
        <Card style={styles.resultCard}>
          <SectionTitle>{t("symptom.result.possibleCauses")}</SectionTitle>
          {causes.map((_, index) => (
            <View key={index} style={styles.cause}>
              <View style={styles.causeName}>
                <Icon name="help_outline" size={20} color={colors.onPrimaryFixed} />
                <Text style={styles.causeNameText}>{causeNames[index]}</Text>
              </View>
              <Text style={styles.causeWhy}>{causeWhys[index]}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.resultCard}>
        <SectionTitle>{t("symptom.result.whatToDo")}</SectionTitle>
        <Bullets items={toDo} icon="check_circle" color={colors.success} />
      </Card>

      {shownNotToDo.length > 0 ? (
        <Card style={styles.resultCard}>
          <SectionTitle>{t("voice.whatNotToDo")}</SectionTitle>
          <Bullets items={shownNotToDo} icon="cancel" color={colors.warning} />
        </Card>
      ) : null}

      <Card style={styles.resultCard}>
        <SectionTitle>{t("symptom.result.dangerSigns")}</SectionTitle>
        <Bullets items={danger} icon="warning" color={colors.emergency} />
      </Card>

      <DocumentDisclaimer
        text={t("symptom.result.disclaimer")}
        lead={t("disclaimer.lead")}
      />

      <View style={styles.savedRow}>
        <Icon name="check_circle" size={20} color={colors.success} />
        <Text style={styles.savedText}>{t("symptom.result.saved")}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  headRow: { flexDirection: "row", gap: spacing.sm },
  headIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.patientTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headBody: { flex: 1, gap: spacing.xs },
  title: { ...type.headlineMd, color: colors.text },
  body: { ...type.bodyMd, color: colors.muted },

  micArea: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  mic: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.patient,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 6,
    borderColor: colors.patientTint,
  },
  micOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryFixedDim,
    transform: [{ scale: 1.08 }],
  },
  micLabel: { ...type.labelLg, color: colors.patient, textAlign: "center" },
  micLabelOn: { color: colors.primary },

  sending: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  sendingTitle: { ...type.headlineMd, color: colors.text, textAlign: "center" },
  sendingHint: { ...type.bodyMd, color: colors.muted, textAlign: "center" },

  urgency: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  urgencyBody: { flex: 1, gap: spacing.xs },
  urgencyTitle: { ...type.headlineLg },
  urgencyText: { ...type.bodyLg },

  actions: { gap: spacing.sm },
  translating: { ...type.labelMd, color: colors.muted },

  resultCard: { gap: spacing.sm },
  quote: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  quoteText: { ...type.bodyLg, color: colors.text, flex: 1, fontStyle: "italic" },
  keywordRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  keyword: {
    backgroundColor: colors.patientTint,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  keywordText: { ...type.labelMd, color: colors.onPrimaryFixed },
  summary: { ...type.bodyLg, color: colors.text },
  redFlags: { ...type.labelLg, color: colors.emergency },

  cause: {
    ...elevation.level1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  causeName: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: colors.patientTint,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  causeNameText: { ...type.labelLg, color: colors.onPrimaryFixed },
  causeWhy: { ...type.bodyLg, color: colors.text },

  bullets: { gap: spacing.sm },
  bulletRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  bulletIcon: { marginTop: 2 },
  bulletText: { ...type.bodyLg, color: colors.text, flex: 1 },

  savedRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  savedText: { ...type.bodyMd, color: colors.muted, flex: 1 },
});
