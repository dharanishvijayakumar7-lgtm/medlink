import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { DocumentDisclaimer } from "@/components/document-disclaimer";
import { Icon } from "@/components/icon";
import { Badge, Button, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, CallSummary } from "@/lib/api";
import {
  answerLabel,
  callDisclaimer,
  channelLabel,
  formatCallDuration,
  languageName,
  urgencyMeta,
} from "@/lib/calls";
import { formatDateTime } from "@/lib/format";
import { translate, useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";
import { regroup, useTranslated } from "@/lib/use-translated";

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
  const { t } = useT();
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
      setError(caught instanceof Error ? caught.message : translate("callDetail.loadFailed"));
    }
  }, [id, code]);

  useFocusEffect(
    useCallback(() => {
      fetchCall();
    }, [fetchCall]),
  );

  // The agent writes these in English. Medicine names and doses are never
  // machine-translated: a wrong number there is dangerous.
  const single = [
    call?.assessment?.category ?? call?.chief_complaint ?? "",
    call?.chief_complaint ?? "",
    call?.summary_text ?? "",
    call?.assessment?.self_care_advice ?? "",
    call?.assessment?.see_doctor_if ?? "",
    call?.assessment?.possible_causes_note ?? "",
  ];
  const answerValues = Object.values(call?.answers ?? {});
  const backgroundItems = call
    ? [...call.known_conditions, ...call.current_medications]
    : [];
  const causeItems = call?.assessment?.possible_causes ?? [];
  const { texts: translated } = useTranslated([
    ...single,
    ...answerValues,
    ...backgroundItems,
    ...causeItems,
  ]);
  const [shown, shownAnswers, shownBackground, shownCauses] = regroup(translated, [
    single.length,
    answerValues.length,
    backgroundItems.length,
    causeItems.length,
  ]);
  const [shownTitle, shownComplaint, shownSummary, shownSelfCare, shownSeeDoctor, shownNote] =
    shown;

  if (!call) {
    return error ? (
      <Screen>
        <ErrorBanner message={error} onRetry={fetchCall} />
      </Screen>
    ) : (
      <Loading label={t("callDetail.loading")} />
    );
  }

  const urgency = urgencyMeta(call.urgency);
  const assessment = call.assessment;
  const answerSlots = Object.keys(call.answers ?? {});
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
            {shownTitle || t("callDetail.fallbackTitle")}
          </Text>
          <Text style={styles.meta}>
            {call.started_at ? formatDateTime(call.started_at) : t("callDetail.dateUnknown")}
          </Text>
          <Text style={styles.meta}>{meta.join(" · ")}</Text>
          {urgency ? <Badge label={urgency.label} tone={urgency.tone} /> : null}
        </View>
      </View>

      {call.urgency === "emergency" ? (
        <View style={styles.emergency}>
          <Text style={styles.emergencyText}>{t("callDetail.emergency")}</Text>
          <Button
            title={t("callDetail.emergencyHelp")}
            icon="emergency"
            onPress={() => router.push("/patient/sos")}
            tone="emergency"
          />
        </View>
      ) : call.escalated ? (
        <View style={styles.advised}>
          <Icon name="local_hospital" size={24} color={colors.warning} />
          <Text style={styles.advisedText}>{t("callDetail.advised")}</Text>
        </View>
      ) : null}

      <DocumentDisclaimer text={callDisclaimer()} />

      {call.summary_text ? (
        <Section icon="auto_awesome" title={t("callDetail.simpleWords")}>
          <Text style={styles.body}>{shownSummary}</Text>
        </Section>
      ) : null}

      {call.chief_complaint || answerSlots.length > 0 ? (
        <Section icon="record_voice_over" title={t("callDetail.whatYouSaid")}>
          {call.chief_complaint ? (
            <Text style={styles.body}>{shownComplaint}</Text>
          ) : null}
          {answerSlots.map((slot, index) => (
            <View key={slot} style={styles.answerRow}>
              <Text style={styles.answerLabel}>{answerLabel(slot)}</Text>
              <Text style={styles.answerValue}>{shownAnswers[index]}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      {shownBackground.length > 0 ? (
        <Section icon="history" title={t("callDetail.background")}>
          <Bullets items={shownBackground} />
        </Section>
      ) : null}

      {call.medicines_discussed.length > 0 ? (
        <Section icon="medication" title={t("callDetail.medicines")}>
          {call.medicines_discussed.map((medicine, index) => (
            <View key={`${medicine.generic_name}-${index}`} style={styles.medRow}>
              <Text style={styles.medName}>
                {medicine.generic_name ?? t("callDetail.medicine")}
              </Text>
              {medicine.brand_names.length > 0 ? (
                <Text style={styles.medDetails}>
                  {t("callDetail.soldAs", { names: medicine.brand_names.join(", ") })}
                </Text>
              ) : null}
              {medicine.adult_dose ? (
                <Text style={styles.medDetails}>
                  {t("callDetail.adultDose", { dose: medicine.adult_dose })}
                </Text>
              ) : null}
              {medicine.max_daily_dose ? (
                <Text style={styles.medDetails}>
                  {t("callDetail.maxDaily", { dose: medicine.max_daily_dose })}
                </Text>
              ) : null}
              {medicine.duration_limit_days ? (
                <Text style={styles.medDetails}>
                  {t("callDetail.durationLimit", { count: medicine.duration_limit_days })}
                </Text>
              ) : null}
            </View>
          ))}
          <Text style={styles.note}>{t("callDetail.checkMedicine")}</Text>
        </Section>
      ) : null}

      {assessment?.self_care_advice || assessment?.see_doctor_if ? (
        <Section icon="tips_and_updates" title={t("callDetail.advice")}>
          {assessment.self_care_advice ? (
            <Text style={styles.body}>{shownSelfCare}</Text>
          ) : null}
          {assessment.see_doctor_if ? (
            <View style={styles.answerRow}>
              <Text style={styles.answerLabel}>{t("callDetail.seeDoctorIf")}</Text>
              <Text style={styles.answerValue}>{shownSeeDoctor}</Text>
            </View>
          ) : null}
        </Section>
      ) : null}

      {assessment && assessment.possible_causes.length > 0 ? (
        <Section icon="psychology" title={t("callDetail.possibleCauses")}>
          <View style={styles.causes}>
            <Bullets items={shownCauses} />
            <Text style={styles.causesNote}>
              {shownNote || t("callDetail.causesNote")}
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
