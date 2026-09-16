import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { DocumentDisclaimer } from "@/components/document-disclaimer";
import { Icon } from "@/components/icon";
import { Button, Card, ErrorBanner, Screen, SectionTitle, TextField } from "@/components/ui";
import { api, TriageAnswer, TriageAssessment, TriageUrgency } from "@/lib/api";
import { TranslationKey, useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";
import { useTranslated } from "@/lib/use-translated";

/**
 * An option's `value` is the English text that is saved and sent to the
 * server - the doctor queue, Gemini and the server's safety rules all read it,
 * so it never changes with the app language. `label` is what is shown.
 */
type Option = { value: string; label: TranslationKey };

type Step =
  | { id: string; question: string; label: TranslationKey; kind: "single"; options: readonly Option[] }
  | { id: string; question: string; label: TranslationKey; kind: "multi"; options: readonly Option[] }
  | {
      id: string;
      question: string;
      label: TranslationKey;
      kind: "text";
      placeholder: TranslationKey;
    };

/** The guided questionnaire. Answers are stored verbatim, in English. */
const STEPS: readonly Step[] = [
  {
    id: "complaint",
    question: "What is troubling you the most?",
    label: "symptom.q.complaint",
    kind: "single",
    options: [
      { value: "Fever", label: "symptom.opt.fever" },
      { value: "Cough or cold", label: "symptom.opt.cough" },
      { value: "Breathing difficulty", label: "symptom.opt.breathing" },
      { value: "Stomach pain", label: "symptom.opt.stomach" },
      { value: "Loose motions", label: "symptom.opt.looseMotions" },
      { value: "Headache", label: "symptom.opt.headache" },
      { value: "Body pain or weakness", label: "symptom.opt.bodyPain" },
      { value: "Injury or wound", label: "symptom.opt.injury" },
      { value: "Pregnancy related", label: "symptom.opt.pregnancy" },
      { value: "Child not feeding well", label: "symptom.opt.childFeeding" },
      { value: "Something else", label: "symptom.opt.somethingElse" },
    ],
  },
  {
    id: "duration",
    question: "How long have you had this?",
    label: "symptom.q.duration",
    kind: "single",
    options: [
      { value: "Less than a day", label: "symptom.opt.lessThanDay" },
      { value: "1-3 days", label: "symptom.opt.oneToThreeDays" },
      { value: "4-7 days", label: "symptom.opt.fourToSevenDays" },
      { value: "More than a week", label: "symptom.opt.moreThanWeek" },
      { value: "More than a month", label: "symptom.opt.moreThanMonth" },
    ],
  },
  {
    id: "severity",
    question: "How bad is it right now?",
    label: "symptom.q.severity",
    kind: "single",
    options: [
      { value: "Mild - I can do my daily work", label: "symptom.opt.mild" },
      { value: "Moderate - it is hard to work", label: "symptom.opt.moderate" },
      { value: "Severe - I cannot manage", label: "symptom.opt.severe" },
    ],
  },
  {
    id: "other_symptoms",
    question: "Do you also have any of these?",
    label: "symptom.q.otherSymptoms",
    kind: "multi",
    options: [
      { value: "Vomiting", label: "symptom.opt.vomiting" },
      { value: "Loose motions", label: "symptom.opt.looseMotions" },
      { value: "Chest pain", label: "symptom.opt.chestPain" },
      { value: "Dizziness or fainting", label: "symptom.opt.dizziness" },
      { value: "Rash", label: "symptom.opt.rash" },
      { value: "Bleeding", label: "symptom.opt.bleeding" },
      { value: "Swelling", label: "symptom.opt.swelling" },
      { value: "High fever", label: "symptom.opt.highFever" },
      { value: "None of these", label: "symptom.opt.noneOfThese" },
    ],
  },
  {
    id: "conditions",
    question: "Any ongoing health conditions?",
    label: "symptom.q.conditions",
    kind: "multi",
    options: [
      { value: "Diabetes", label: "symptom.opt.diabetes" },
      { value: "High blood pressure", label: "symptom.opt.bloodPressure" },
      { value: "Asthma or breathing problem", label: "symptom.opt.asthma" },
      { value: "Heart problem", label: "symptom.opt.heart" },
      { value: "TB", label: "symptom.opt.tb" },
      { value: "Currently pregnant", label: "symptom.opt.pregnant" },
      { value: "None", label: "symptom.opt.none" },
    ],
  },
  {
    id: "notes",
    question: "Anything else the doctor should know?",
    label: "symptom.q.notes",
    kind: "text",
    placeholder: "symptom.notesPlaceholder",
  },
];

type AnswerMap = Record<string, string | string[]>;

/** One large tap card per option, with a radio or check indicator. */
function OptionCard({
  label,
  selected,
  multi,
  onPress,
}: {
  label: string;
  selected: boolean;
  multi: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={multi ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.indicator, selected && styles.indicatorOn]}>
        {selected ? <Icon name="check" size={20} color={colors.onPatient} /> : null}
      </View>
      <Text style={[styles.optionLabel, selected && styles.optionLabelOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

const URGENCY: Record<
  TriageUrgency,
  {
    icon: string;
    title: TranslationKey;
    body: TranslationKey;
    background: string;
    foreground: string;
  }
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

function BulletList({ items, icon, color }: { items: string[]; icon: string; color: string }) {
  return (
    <View style={styles.bullets}>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletRow}>
          <Icon name={icon} size={20} color={color} style={styles.bulletIcon} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/** What the patient sees after submitting: how urgent, and what to do. */
function AssessmentView({ assessment }: { assessment: TriageAssessment }) {
  const router = useRouter();
  const { t } = useT();
  const level = URGENCY[assessment.urgency];

  // Written in English by the server; translated here as one batch.
  const sections = [
    [assessment.plain_summary],
    assessment.red_flags,
    assessment.possible_causes,
    assessment.what_to_do,
    assessment.danger_signs,
  ];
  const { texts, pending } = useTranslated(sections.flat());
  const parts: string[][] = [];
  let offset = 0;
  for (const section of sections) {
    parts.push(texts.slice(offset, offset + section.length));
    offset += section.length;
  }
  const [[summary], redFlags, causes, steps, dangerSigns] = parts;

  return (
    <>
      <View
        style={[styles.urgency, { backgroundColor: level.background }]}
        accessibilityRole="alert"
      >
        <Icon name={level.icon} size={40} color={level.foreground} />
        <View style={styles.urgencyBody}>
          <Text style={[styles.urgencyTitle, { color: level.foreground }]}>
            {t(level.title)}
          </Text>
          <Text style={[styles.urgencyText, { color: level.foreground }]}>
            {t(level.body)}
          </Text>
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
          <BulletList items={causes} icon="help_outline" color={colors.patient} />
        </Card>
      ) : null}

      <Card style={styles.resultCard}>
        <SectionTitle>{t("symptom.result.whatToDo")}</SectionTitle>
        <BulletList items={steps} icon="check_circle" color={colors.success} />
      </Card>

      <Card style={styles.resultCard}>
        <SectionTitle>{t("symptom.result.dangerSigns")}</SectionTitle>
        <BulletList items={dangerSigns} icon="warning" color={colors.emergency} />
      </Card>

      <DocumentDisclaimer text={t("symptom.result.disclaimer")} />

      <View style={styles.savedRow}>
        <Icon name="check_circle" size={20} color={colors.success} />
        <Text style={styles.savedText}>{t("symptom.result.saved")}</Text>
      </View>
    </>
  );
}

export default function SymptomCheck() {
  const router = useRouter();
  const { session } = usePatientSession();
  const { t } = useT();

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<TriageAssessment | null>(null);
  // Saved, but the server returned no result (should not happen, but the
  // patient must still be told their answers are safe).
  const [savedWithoutResult, setSavedWithoutResult] = useState(false);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  const current = answers[step.id];

  const canAdvance =
    step.kind === "text" ||
    (step.kind === "single" && typeof current === "string" && current.length > 0) ||
    (step.kind === "multi" && Array.isArray(current) && current.length > 0);

  function setAnswer(value: string | string[]) {
    setAnswers((previous) => ({ ...previous, [step.id]: value }));
  }

  function toggleMulti(option: string) {
    const values = Array.isArray(current) ? current : [];
    setAnswer(
      values.includes(option)
        ? values.filter((value) => value !== option)
        : [...values, option],
    );
  }

  function buildSummary(): string {
    // A short line the doctor queue can read at a glance.
    return ["complaint", "duration", "severity"]
      .map((id) => answers[id])
      .filter((value): value is string => typeof value === "string" && !!value)
      // "Severe - I cannot manage" reads better in a list as just "Severe".
      .map((value) => value.split(" - ")[0])
      .join(", ");
  }

  async function submit() {
    if (!session) {
      setError(t("symptom.noSession"));
      return;
    }

    const payload: TriageAnswer[] = STEPS.map((entry) => {
      const value = answers[entry.id];
      const answer = Array.isArray(value) ? value.join(", ") : (value ?? "").trim();
      return { id: entry.id, question: entry.question, answer };
    }).filter((entry) => entry.answer.length > 0);

    setError(null);
    setSubmitting(true);
    try {
      const entry = await api.addTriageEntry(session.unique_code, {
        answers: payload,
        summary: buildSummary(),
      });
      if (entry.assessment) setAssessment(entry.assessment);
      else setSavedWithoutResult(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("symptom.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const finishButtons = (
    <>
      <Button
        title={t("symptom.viewRecord")}
        icon="folder_shared"
        onPress={() => router.replace("/patient/record")}
        tone="patient"
      />
      <Button
        title={t("symptom.backHome")}
        onPress={() => router.back()}
        tone="patient"
        variant="outline"
      />
    </>
  );

  if (assessment) {
    return (
      <Screen>
        <AssessmentView assessment={assessment} />
        {finishButtons}
      </Screen>
    );
  }

  if (savedWithoutResult) {
    return (
      <Screen>
        <View style={styles.doneCard}>
          <Icon name="check_circle" size={48} color={colors.success} />
          <Text style={styles.doneTitle}>{t("symptom.savedTitle")}</Text>
          <Text style={styles.doneBody}>{t("symptom.result.saved")}</Text>
        </View>
        {finishButtons}
      </Screen>
    );
  }

  if (submitting) {
    return (
      <Screen>
        <View style={styles.doneCard} accessibilityLiveRegion="polite">
          <Icon name="health_and_safety" size={48} color={colors.patient} />
          <Text style={styles.doneTitle}>{t("symptom.checking")}</Text>
          <Text style={styles.doneBody}>{t("symptom.checkingHint")}</Text>
          <ActivityIndicator size="large" color={colors.patient} />
        </View>
      </Screen>
    );
  }

  const remaining = STEPS.length - index - 1;

  return (
    <Screen>
      <View style={styles.progress}>
        <View style={styles.progressRow}>
          <View style={styles.progressLeft}>
            <View style={styles.dot} />
            <Text style={styles.progressLabel}>
              {t("symptom.progress", { current: index + 1, total: STEPS.length })}
            </Text>
          </View>
          <Text style={styles.progressHint}>
            {remaining === 0
              ? t("symptom.lastQuestion")
              : t("symptom.questionsLeft", { count: remaining })}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          {STEPS.map((entry, position) => (
            <View
              key={entry.id}
              style={[
                styles.progressSegment,
                position <= index && styles.progressSegmentOn,
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.contextBand}>
        <Icon name="health_and_safety" size={18} color={colors.patient} />
        <Text style={styles.contextText}>{t("symptom.context")}</Text>
      </View>

      <Text style={styles.question}>{t(step.label)}</Text>

      {step.kind === "single" ? (
        <View style={styles.options} accessibilityRole="radiogroup">
          {step.options.map((option) => (
            <OptionCard
              key={option.value}
              label={t(option.label)}
              multi={false}
              selected={current === option.value}
              onPress={() => setAnswer(option.value)}
            />
          ))}
        </View>
      ) : null}

      {step.kind === "multi" ? (
        <View style={styles.options}>
          {step.options.map((option) => (
            <OptionCard
              key={option.value}
              label={t(option.label)}
              multi
              selected={Array.isArray(current) && current.includes(option.value)}
              onPress={() => toggleMulti(option.value)}
            />
          ))}
        </View>
      ) : null}

      {step.kind === "text" ? (
        <TextField
          label={t("symptom.yourAnswer")}
          value={typeof current === "string" ? current : ""}
          onChangeText={setAnswer}
          placeholder={t(step.placeholder)}
          multiline
        />
      ) : null}

      {/* Beside the buttons, where the patient is looking when it fails. */}
      {error ? <ErrorBanner message={error} onRetry={isLast ? submit : undefined} /> : null}

      <View style={styles.nav}>
        {index > 0 ? (
          <Button
            title={t("common.back")}
            onPress={() => {
              setError(null);
              setIndex(index - 1);
            }}
            tone="patient"
            variant="outline"
            style={styles.navButton}
          />
        ) : null}
        <Button
          title={isLast ? t("symptom.submit") : t("common.next")}
          icon={isLast ? "check" : "arrow_forward"}
          onPress={isLast ? submit : () => setIndex(index + 1)}
          disabled={!canAdvance}
          tone="patient"
          style={styles.navButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9 },

  progress: { gap: spacing.xs },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  progressLeft: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.patient,
  },
  progressLabel: { ...type.labelMd, color: colors.patient, letterSpacing: 0.8 },
  progressHint: { ...type.labelMd, color: colors.muted },
  progressTrack: { flexDirection: "row", gap: spacing.xs },
  progressSegment: {
    flex: 1,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceContainerHighest,
  },
  progressSegmentOn: { backgroundColor: colors.patient },

  contextBand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  contextText: { ...type.labelMd, color: colors.text, flex: 1 },

  question: { ...type.headlineLg, color: colors.text, marginTop: spacing.xs },

  options: { gap: spacing.sm },
  option: {
    ...elevation.level1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionSelected: { borderColor: colors.patient, backgroundColor: colors.patientTint },
  indicator: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorOn: { backgroundColor: colors.patient },
  optionLabel: { ...type.headlineMd, color: colors.text, flex: 1 },
  optionLabelOn: { color: colors.onPrimaryFixed },

  nav: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  navButton: { flex: 1 },

  doneCard: {
    ...elevation.level1,
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  doneTitle: { ...type.headlineMd, color: colors.text, textAlign: "center" },
  doneBody: { ...type.bodyMd, color: colors.muted, textAlign: "center" },

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
  summary: { ...type.bodyLg, color: colors.text },
  redFlags: { ...type.labelLg, color: colors.emergency },

  bullets: { gap: spacing.sm },
  bulletRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  bulletIcon: { marginTop: 2 },
  bulletText: { ...type.bodyLg, color: colors.text, flex: 1 },

  savedRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  savedText: { ...type.bodyMd, color: colors.muted, flex: 1 },
});
