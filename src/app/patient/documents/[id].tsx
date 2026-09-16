import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";

import { DocumentDisclaimer } from "@/components/document-disclaimer";
import { Icon } from "@/components/icon";
import { Button, ErrorBanner, IconCircle, Loading, Screen } from "@/components/ui";
import {
  api,
  documentFileUrl,
  isDocumentInFlight,
  LabFinding,
  MedicalDocument,
} from "@/lib/api";
import { formatIsoDate } from "@/lib/format";
import { translate, useT } from "@/lib/i18n";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";
import { regroup, useTranslated } from "@/lib/use-translated";

const POLL_MS = 3_000;

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
        <IconCircle icon={icon} size={40} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/** A lab value outside its range, explained - never just the raw lab term. */
function LabCard({
  finding,
  direction,
  explanation,
}: {
  finding: LabFinding;
  direction: "low" | "high";
  /** The plain explanation in the app's language. */
  explanation: string;
}) {
  const { t } = useT();
  return (
    <View style={styles.labCard}>
      <View style={styles.labHead}>
        <Icon
          name={direction === "low" ? "trending_down" : "trending_up"}
          size={22}
          color={colors.warning}
        />
        <Text style={styles.labTest}>{finding.test}</Text>
        <Text style={styles.labFlag}>
          {direction === "low" ? t("document.low") : t("document.high")}
        </Text>
      </View>
      {finding.value ? <Text style={styles.labValue}>{finding.value}</Text> : null}
      <Text style={styles.labExplanation}>{explanation}</Text>
    </View>
  );
}

export default function DocumentDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const documentId = Number(id);
  const { t } = useT();

  const [document, setDocument] = useState<MedicalDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  // No synchronous setState, so it is safe from effects and the poll timer.
  const fetchDocument = useCallback(async () => {
    if (!documentId) return;
    try {
      setDocument(await api.getDocument(documentId));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : translate("document.loadFailed"));
    }
  }, [documentId]);

  useFocusEffect(
    useCallback(() => {
      fetchDocument();
    }, [fetchDocument]),
  );

  const inFlight = document ? isDocumentInFlight(document) : false;
  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(fetchDocument, POLL_MS);
    return () => clearInterval(timer);
  }, [inFlight, fetchDocument]);

  async function openOriginal() {
    if (!document) return;
    setOpenError(null);
    try {
      await Linking.openURL(documentFileUrl(document));
    } catch {
      setOpenError(translate("document.openFailed"));
    }
  }

  // Gemini writes these in English. Medicine names, doses, lab names and
  // values are never machine-translated: a wrong word or number there is
  // dangerous.
  const summaryData = document?.status === "DONE" ? document.extracted_summary : null;
  const single = [
    document?.disclaimer ?? "",
    document?.failure_reason ?? "",
    summaryData?.plain_summary ?? "",
    summaryData?.suggested_next_steps ?? "",
  ];
  const symptomItems = summaryData?.symptoms ?? [];
  const lowItems = (summaryData?.deficiencies ?? []).map((f) => f.plain_explanation);
  const highItems = (summaryData?.excesses ?? []).map((f) => f.plain_explanation);
  const termItems = (summaryData?.key_terms ?? []).map((term) => term.explanation);
  const { texts: translated } = useTranslated([
    ...single,
    ...symptomItems,
    ...lowItems,
    ...highItems,
    ...termItems,
  ]);
  const [
    [shownDisclaimer, shownFailure, shownSummary, shownNextSteps],
    shownSymptoms,
    shownLow,
    shownHigh,
    shownTerms,
  ] = regroup(translated, [
    single.length,
    symptomItems.length,
    lowItems.length,
    highItems.length,
    termItems.length,
  ]);

  if (!document) {
    return error ? (
      <Screen>
        <ErrorBanner message={error} onRetry={fetchDocument} />
      </Screen>
    ) : (
      <Loading label={t("document.loading")} />
    );
  }

  const summary = document.extracted_summary;

  return (
    <Screen>
      {error ? <ErrorBanner message={error} onRetry={fetchDocument} /> : null}

      <View style={styles.headerCard}>
        <IconCircle icon="picture_as_pdf" size={52} />
        <View style={styles.headerBody}>
          <Text style={styles.hospital}>
            {document.hospital_name ?? t("document.hospitalUnknown")}
          </Text>
          <Text style={styles.meta}>
            {document.visit_date
              ? t("document.visit", { date: formatIsoDate(document.visit_date) })
              : t("document.visitUnknown")}
          </Text>
        </View>
      </View>

      {inFlight ? (
        <View style={styles.analyzing}>
          <ActivityIndicator size="large" color={colors.patient} />
          <Text style={styles.analyzingTitle}>{t("document.analyzing")}</Text>
          <Text style={styles.analyzingBody}>{t("document.analyzingBody")}</Text>
        </View>
      ) : null}

      {document.status === "FAILED" ? (
        <View style={styles.failed}>
          <Icon name="error_outline" size={32} color={colors.warning} />
          <Text style={styles.failedTitle}>{t("document.failedTitle")}</Text>
          <Text style={styles.failedBody}>{shownFailure}</Text>
          <Button
            title={t("document.uploadAnother")}
            icon="upload_file"
            onPress={() => router.replace("/patient/documents/upload")}
            tone="patient"
          />
        </View>
      ) : null}

      {document.status === "DONE" && summary ? (
        <>
          <DocumentDisclaimer text={shownDisclaimer} />

          <Section icon="auto_awesome" title={t("callDetail.simpleWords")}>
            <Text style={styles.body}>{shownSummary}</Text>
          </Section>

          {summary.symptoms.length > 0 ? (
            <Section icon="sick" title={t("document.symptoms")}>
              {shownSymptoms.map((symptom, index) => (
                <View key={`${symptom}-${index}`} style={styles.bulletRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.bulletText}>{symptom}</Text>
                </View>
              ))}
            </Section>
          ) : null}

          {summary.medications.length > 0 ? (
            <Section icon="medication" title={t("document.medicines")}>
              {summary.medications.map((medication, index) => (
                <View key={`${medication.name}-${index}`} style={styles.medRow}>
                  <Text style={styles.medName}>{medication.name}</Text>
                  {medication.details ? (
                    <Text style={styles.medDetails}>{medication.details}</Text>
                  ) : null}
                </View>
              ))}
            </Section>
          ) : null}

          {summary.deficiencies.length > 0 || summary.excesses.length > 0 ? (
            <Section icon="science" title={t("document.labs")}>
              {summary.deficiencies.map((finding, index) => (
                <LabCard
                  key={`low-${index}`}
                  finding={finding}
                  direction="low"
                  explanation={shownLow[index]}
                />
              ))}
              {summary.excesses.map((finding, index) => (
                <LabCard
                  key={`high-${index}`}
                  finding={finding}
                  direction="high"
                  explanation={shownHigh[index]}
                />
              ))}
            </Section>
          ) : null}

          {summary.key_terms.length > 0 ? (
            <Section icon="menu_book" title={t("document.terms")}>
              {summary.key_terms.map((term, index) => (
                <View key={`${term.term}-${index}`} style={styles.termRow}>
                  <Text style={styles.term}>{term.term}</Text>
                  <Text style={styles.termExplanation}>{shownTerms[index]}</Text>
                </View>
              ))}
            </Section>
          ) : null}

          <Section icon="lightbulb" title={t("document.meaning")}>
            <Text style={styles.body}>{shownNextSteps}</Text>
            <Text style={styles.notDiagnosis}>{t("document.notDiagnosis")}</Text>
          </Section>
        </>
      ) : null}

      {openError ? <ErrorBanner message={openError} /> : null}
      <Button
        title={t("document.openPdf")}
        icon="open_in_new"
        onPress={openOriginal}
        tone="patient"
        variant="outline"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    ...elevation.level1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  headerBody: { flex: 1, minWidth: 0, gap: 2 },
  hospital: { ...type.headlineMd, color: colors.text },
  meta: { ...type.bodyLg, fontSize: 16, lineHeight: 24, color: colors.muted },

  analyzing: {
    ...elevation.level1,
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  analyzingTitle: { ...type.headlineMd, color: colors.text, textAlign: "center" },
  analyzingBody: { ...type.bodyLg, color: colors.muted, textAlign: "center" },

  failed: {
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.lg,
  },
  failedTitle: { ...type.headlineMd, color: colors.text, textAlign: "center" },
  failedBody: { ...type.bodyLg, color: colors.text, textAlign: "center" },

  section: {
    ...elevation.level1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sectionTitle: { ...type.headlineMd, color: colors.text, flex: 1 },
  body: { ...type.bodyLg, color: colors.text },

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

  labCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  labHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  labTest: { ...type.labelLg, color: colors.text, flex: 1 },
  labFlag: { ...type.labelMd, color: colors.warning },
  labValue: { ...type.bodyMd, color: colors.muted },
  labExplanation: { ...type.bodyLg, color: colors.text },

  termRow: {
    borderLeftWidth: 3,
    borderLeftColor: colors.patient,
    paddingLeft: spacing.sm,
    gap: 2,
  },
  term: { ...type.labelLg, color: colors.text },
  termExplanation: { ...type.bodyMd, color: colors.muted },

  notDiagnosis: { ...type.labelMd, color: colors.muted },
});
