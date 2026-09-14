import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DocumentDisclaimer } from "@/components/document-disclaimer";
import { Icon } from "@/components/icon";
import { Badge, Button, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, CallSummary } from "@/lib/api";
import {
  answerLabel,
  CALL_DISCLAIMER,
  channelLabel,
  formatCallDuration,
  languageName,
  urgencyMeta,
} from "@/lib/calls";
import { formatDateTime } from "@/lib/format";
import { usePatientSession } from "@/lib/patient-session";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";

function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Icon name={icon} size={22} color={colors.patient} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.bulletRow}>
          <View style={styles.bullet} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

export default function CallDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = usePatientSession();
  const code = session?.unique_code ?? "";

  const [call, setCall] = useState<CallSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // No synchronous setState, so it is safe to call from a focus effect.
  const fetchCall = useCallback(async () => {
    if (!id || !code) return;
    try {
      setCall(await api.getPatientCall(code, id));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this call.");
    }
  }, [id, code]);

  useFocusEffect(
    useCallback(() => {
      fetchCall();
    }, [fetchCall]),
  );

  if (!call) {
    return error ? (
      <Screen>
        <ErrorBanner message={error} onRetry={fetchCall} />
      </Screen>
    ) : (
      <Loading label="Loading call..." />
    );
  }

  const urgency = urgencyMeta(call.urgency);
  const assessment = call.assessment;
  const answers = Object.entries(call.answers ?? {});
  const background = [...call.known_conditions, ...call.current_medications];
  const meta = [
    channelLabel(call.channel),
    formatCallDuration(call.duration_sec),
    languageName(call.language),
  ].filter(Boolean);

  return (
    <Screen>
      {error ? <ErrorBanner message={error} onRetry={fetchCall} /> : null}

      <View style={styles.headerCard}>
        <View style={styles.callIcon}>
          <Icon name="phone_in_talk" size={28} color={colors.patient} />
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle}>
            {assessment?.category ?? call.chief_complaint ?? "Call to MedLink"}
          </Text>
          <Text style={styles.meta}>
            {call.started_at ? formatDateTime(call.started_at) : "Date not known"}
          </Text>
          <Text style={styles.meta}>{meta.join(" · ")}</Text>
          {urgency ? <Badge label={urgency.label} tone={urgency.tone} /> : null}
        </View>
      </View>

      {call.urgency === "emergency" ? (
        <View style={styles.emergency}>
          <Text style={styles.emergencyText}>
            This call was assessed as an emergency. If you still feel this way, get
            help now.
          </Text>
          <Button
            title="Emergency help"
            icon="emergency"
            onPress={() => router.push("/patient/sos")}
            tone="emergency"
          />
        </View>
      ) : call.escalated ? (
        <View style={styles.advised}>
          <Icon name="local_hospital" size={24} color={colors.warning} />
          <Text style={styles.advisedText}>You were advised to see a doctor.</Text>
        </View>
      ) : null}

      <DocumentDisclaimer text={CALL_DISCLAIMER} />

      {call.summary_text ? (
        <Section icon="auto_awesome" title="In simple words">
          <Text style={styles.body}>{call.summary_text}</Text>
        </Section>
      ) : null}

      {call.chief_complaint || answers.length > 0 ? (
        <Section icon="record_voice_over" title="What you told MedLink">
          {call.chief_complaint ? (
            <Text style={styles.body}>{call.chief_complaint}</Text>
          ) : null}
          {answers.map(([slot, answer]) => (
            <View key={slot} style={styles.answerRow}>
              <Text style={styles.answerLabel}>{answerLabel(slot)}</Text>
              <Text style={styles.answerValue}>{answer}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      {background.length > 0 ? (
        <Section icon="history" title="Your health background">
          <Bullets items={background} />
        </Section>
      ) : null}

      {call.medicines_discussed.length > 0 ? (
        <Section icon="medication" title="Medicines discussed">
          {call.medicines_discussed.map((medicine, index) => (
            <View key={`${medicine.generic_name}-${index}`} style={styles.medRow}>
              <Text style={styles.medName}>{medicine.generic_name ?? "Medicine"}</Text>
              {medicine.brand_names.length > 0 ? (
                <Text style={styles.medDetails}>
                  Sold as {medicine.brand_names.join(", ")}
                </Text>
              ) : null}
              {medicine.adult_dose ? (
                <Text style={styles.medDetails}>Adult dose: {medicine.adult_dose}</Text>
              ) : null}
              {medicine.max_daily_dose ? (
                <Text style={styles.medDetails}>
                  Do not take more than {medicine.max_daily_dose} a day
                </Text>
              ) : null}
              {medicine.duration_limit_days ? (
                <Text style={styles.medDetails}>
                  Use for at most {medicine.duration_limit_days} day
                  {medicine.duration_limit_days === 1 ? "" : "s"} without a doctor
                </Text>
              ) : null}
            </View>
          ))}
          <Text style={styles.note}>
            Check with a doctor or pharmacist before taking any medicine.
          </Text>
        </Section>
      ) : null}

      {assessment?.self_care_advice || assessment?.see_doctor_if ? (
        <Section icon="tips_and_updates" title="Advice">
          {assessment.self_care_advice ? (
            <Text style={styles.body}>{assessment.self_care_advice}</Text>
          ) : null}
          {assessment.see_doctor_if ? (
            <View style={styles.answerRow}>
              <Text style={styles.answerLabel}>See a doctor if</Text>
              <Text style={styles.answerValue}>{assessment.see_doctor_if}</Text>
            </View>
          ) : null}
        </Section>
      ) : null}

      {assessment && assessment.possible_causes.length > 0 ? (
        <Section icon="psychology" title="Possible causes">
          <View style={styles.causes}>
            <Bullets items={assessment.possible_causes} />
            <Text style={styles.causesNote}>
              {assessment.possible_causes_note ??
                "Suggested by AI from what you said. Not a diagnosis."}
            </Text>
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    ...elevation.level1,
    flexDirection: "row",
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  callIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.tile,
    backgroundColor: colors.patientTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBody: { flex: 1, minWidth: 0, gap: spacing.xs },
  headerTitle: { ...type.headlineMd, color: colors.text },
  meta: { ...type.bodyMd, color: colors.muted },

  emergency: {
    gap: spacing.sm,
    backgroundColor: colors.emergencyTint,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.emergency,
    padding: spacing.md,
  },
  emergencyText: { ...type.bodyLg, color: colors.text },
  advised: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warningTint,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.warning,
    padding: spacing.md,
  },
  advisedText: { ...type.bodyLg, color: colors.text, flex: 1 },

  section: {
    ...elevation.level1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  sectionTitle: { ...type.labelLg, color: colors.text, flex: 1 },
  body: { ...type.bodyLg, color: colors.text },

  answerRow: {
    borderLeftWidth: 3,
    borderLeftColor: colors.patientTint,
    paddingLeft: spacing.sm,
    gap: 2,
  },
  answerLabel: { ...type.labelMd, color: colors.muted },
  answerValue: { ...type.bodyLg, color: colors.text },

  bulletRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.patient,
  },
  bulletText: { ...type.bodyLg, color: colors.text, flex: 1 },

  medRow: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  medName: { ...type.labelLg, color: colors.text },
  medDetails: { ...type.bodyMd, color: colors.muted },
  note: { ...type.labelMd, color: colors.muted },

  causes: {
    backgroundColor: colors.warningTint,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  causesNote: { ...type.labelMd, color: colors.text },
});
