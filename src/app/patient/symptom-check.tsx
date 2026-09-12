import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { Button, ErrorBanner, Screen, TextField } from "@/components/ui";
import { api, TriageAnswer } from "@/lib/api";
import { usePatientSession } from "@/lib/patient-session";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";

type Step =
  | { id: string; question: string; kind: "single"; options: readonly string[] }
  | { id: string; question: string; kind: "multi"; options: readonly string[] }
  | { id: string; question: string; kind: "text"; placeholder: string };

/** The guided questionnaire. Answers are stored verbatim alongside the summary. */
const STEPS: readonly Step[] = [
  {
    id: "complaint",
    question: "What is troubling you the most?",
    kind: "single",
    options: [
      "Fever",
      "Cough or cold",
      "Breathing difficulty",
      "Stomach pain",
      "Loose motions",
      "Headache",
      "Body pain or weakness",
      "Injury or wound",
      "Pregnancy related",
      "Child not feeding well",
      "Something else",
    ],
  },
  {
    id: "duration",
    question: "How long have you had this?",
    kind: "single",
    options: [
      "Less than a day",
      "1-3 days",
      "4-7 days",
      "More than a week",
      "More than a month",
    ],
  },
  {
    id: "severity",
    question: "How bad is it right now?",
    kind: "single",
    options: [
      "Mild - I can do my daily work",
      "Moderate - it is hard to work",
      "Severe - I cannot manage",
    ],
  },
  {
    id: "other_symptoms",
    question: "Do you also have any of these?",
    kind: "multi",
    options: [
      "Vomiting",
      "Loose motions",
      "Chest pain",
      "Dizziness or fainting",
      "Rash",
      "Bleeding",
      "Swelling",
      "High fever",
      "None of these",
    ],
  },
  {
    id: "conditions",
    question: "Any ongoing health conditions?",
    kind: "multi",
    options: [
      "Diabetes",
      "High blood pressure",
      "Asthma or breathing problem",
      "Heart problem",
      "TB",
      "Currently pregnant",
      "None",
    ],
  },
  {
    id: "notes",
    question: "Anything else the doctor should know?",
    kind: "text",
    placeholder: "Optional - medicines you take, recent travel, anything else",
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

export default function SymptomCheck() {
  const router = useRouter();
  const { session } = usePatientSession();

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSummary, setSubmittedSummary] = useState<string | null>(null);

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
    if (!session) return;

    const payload: TriageAnswer[] = STEPS.map((entry) => {
      const value = answers[entry.id];
      const answer = Array.isArray(value) ? value.join(", ") : (value ?? "").trim();
      return { question: entry.question, answer };
    }).filter((entry) => entry.answer.length > 0);

    setError(null);
    setSubmitting(true);
    try {
      const summary = buildSummary();
      await api.addTriageEntry(session.unique_code, { answers: payload, summary });
      setSubmittedSummary(summary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your answers.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedSummary !== null) {
    return (
      <Screen>
        <View style={styles.doneCard}>
          <View style={styles.doneTick}>
            <Icon name="check_circle" size={48} color={colors.success} />
          </View>
          <Text style={styles.doneTitle}>Symptom check saved</Text>
          <Text style={styles.doneBody}>
            Your answers are on your record and in the doctor queue.
          </Text>
          <Text style={styles.doneSummary}>{submittedSummary}</Text>
        </View>
        <Button
          title="View my record"
          icon="folder_shared"
          onPress={() => router.replace("/patient/record")}
          tone="patient"
        />
        <Button
          title="Back to home"
          onPress={() => router.back()}
          tone="patient"
          variant="outline"
        />
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
              QUESTION {index + 1} OF {STEPS.length}
            </Text>
          </View>
          <Text style={styles.progressHint}>
            {remaining === 0
              ? "Last question"
              : `${remaining} question${remaining === 1 ? "" : "s"} left`}
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
        <Text style={styles.contextText}>Standard vitals assessment</Text>
      </View>

      <Text style={styles.question}>{step.question}</Text>

      {error ? <ErrorBanner message={error} /> : null}

      {step.kind === "single" ? (
        <View style={styles.options} accessibilityRole="radiogroup">
          {step.options.map((option) => (
            <OptionCard
              key={option}
              label={option}
              multi={false}
              selected={current === option}
              onPress={() => setAnswer(option)}
            />
          ))}
        </View>
      ) : null}

      {step.kind === "multi" ? (
        <View style={styles.options}>
          {step.options.map((option) => (
            <OptionCard
              key={option}
              label={option}
              multi
              selected={Array.isArray(current) && current.includes(option)}
              onPress={() => toggleMulti(option)}
            />
          ))}
        </View>
      ) : null}

      {step.kind === "text" ? (
        <TextField
          label="Your answer"
          value={typeof current === "string" ? current : ""}
          onChangeText={setAnswer}
          placeholder={step.placeholder}
          multiline
        />
      ) : null}

      <View style={styles.nav}>
        {index > 0 ? (
          <Button
            title="Back"
            onPress={() => setIndex(index - 1)}
            tone="patient"
            variant="outline"
            style={styles.navButton}
          />
        ) : null}
        <Button
          title={isLast ? "Submit" : "Next"}
          icon={isLast ? "check" : "arrow_forward"}
          onPress={isLast ? submit : () => setIndex(index + 1)}
          disabled={!canAdvance}
          loading={submitting}
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
  contextText: { ...type.labelMd, color: colors.text },

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
  doneTick: { marginBottom: spacing.xs },
  doneTitle: { ...type.headlineMd, color: colors.text },
  doneBody: { ...type.bodyMd, color: colors.muted, textAlign: "center" },
  doneSummary: {
    ...type.labelLg,
    color: colors.patientDark,
    backgroundColor: colors.patientTint,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    textAlign: "center",
    overflow: "hidden",
  },
});
