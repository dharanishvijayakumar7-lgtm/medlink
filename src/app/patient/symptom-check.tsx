import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  Button,
  Card,
  ChoiceChips,
  ErrorBanner,
  MultiChoiceChips,
  Screen,
  TextField,
} from "@/components/ui";
import { api, TriageAnswer } from "@/lib/api";
import { usePatientSession } from "@/lib/patient-session";
import { colors, radius, spacing } from "@/lib/theme";

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

  function buildSummary(): string {
    // A short line the doctor queue can read at a glance.
    const parts = ["complaint", "duration", "severity"]
      .map((id) => answers[id])
      .filter((value): value is string => typeof value === "string" && !!value)
      // "Severe - I cannot manage" reads better in a list as just "Severe".
      .map((value) => value.split(" - ")[0]);
    return parts.join(", ");
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
        <Card style={styles.doneCard}>
          <Text style={styles.doneTick}>{"✓"}</Text>
          <Text style={styles.doneTitle}>Symptom check saved</Text>
          <Text style={styles.doneBody}>
            Your answers are on your record and in the doctor queue.
          </Text>
          <Text style={styles.doneSummary}>{submittedSummary}</Text>
        </Card>
        <Button
          title="View my record"
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

  return (
    <Screen>
      <View style={styles.progress}>
        <Text style={styles.progressLabel}>
          Step {index + 1} of {STEPS.length}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((index + 1) / STEPS.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      <Text style={styles.question}>{step.question}</Text>

      {error ? <ErrorBanner message={error} /> : null}

      {step.kind === "single" ? (
        <ChoiceChips
          options={step.options}
          value={typeof current === "string" ? current : null}
          onChange={setAnswer}
        />
      ) : null}

      {step.kind === "multi" ? (
        <MultiChoiceChips
          options={step.options}
          values={Array.isArray(current) ? current : []}
          onChange={setAnswer}
        />
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
  progress: { gap: spacing.sm },
  progressLabel: { fontSize: 13, fontWeight: "600", color: colors.muted },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressFill: { height: 6, backgroundColor: colors.patient },

  question: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 30,
    marginTop: spacing.sm,
  },

  nav: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  navButton: { flex: 1 },

  doneCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  doneTick: {
    fontSize: 30,
    fontWeight: "900",
    color: "#FFFFFF",
    backgroundColor: colors.success,
    width: 64,
    height: 64,
    borderRadius: 32,
    textAlign: "center",
    lineHeight: 64,
    overflow: "hidden",
  },
  doneTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  doneBody: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 21 },
  doneSummary: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.patientDark,
    backgroundColor: colors.patientTint,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
