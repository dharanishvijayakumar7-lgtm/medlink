import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";

import { DocumentDisclaimer } from "@/components/document-disclaimer";
import { Icon } from "@/components/icon";
import { Button, ErrorBanner, Loading, Screen } from "@/components/ui";
import {
  api,
  documentFileUrl,
  isDocumentInFlight,
  LabFinding,
  MedicalDocument,
} from "@/lib/api";
import { formatFileSize, formatIsoDate } from "@/lib/format";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";

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
        <Icon name={icon} size={22} color={colors.patient} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/** A lab value outside its range, explained - never just the raw lab term. */
function LabCard({ finding, direction }: { finding: LabFinding; direction: "low" | "high" }) {
  return (
    <View style={styles.labCard}>
      <View style={styles.labHead}>
        <Icon
          name={direction === "low" ? "trending_down" : "trending_up"}
          size={22}
          color={colors.warning}
        />
        <Text style={styles.labTest}>{finding.test}</Text>
        <Text style={styles.labFlag}>{direction === "low" ? "LOW" : "HIGH"}</Text>
      </View>
      {finding.value ? <Text style={styles.labValue}>{finding.value}</Text> : null}
      <Text style={styles.labExplanation}>{finding.plain_explanation}</Text>
    </View>
  );
}

export default function DocumentDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const documentId = Number(id);

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
      setError(caught instanceof Error ? caught.message : "Could not load this document.");
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
      setOpenError("Could not open the PDF on this phone.");
    }
  }

  if (!document) {
    return error ? (
      <Screen>
        <ErrorBanner message={error} onRetry={fetchDocument} />
      </Screen>
    ) : (
      <Loading label="Loading document..." />
    );
  }

  const summary = document.extracted_summary;

  return (
    <Screen>
      {error ? <ErrorBanner message={error} onRetry={fetchDocument} /> : null}

      <View style={styles.headerCard}>
        <View style={styles.fileIcon}>
          <Icon name="picture_as_pdf" size={28} color={colors.patient} />
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.hospital}>
            {document.hospital_name ?? "Hospital not named"}
          </Text>
          <Text style={styles.meta}>
            {document.visit_date
              ? `Visit ${formatIsoDate(document.visit_date)}`
              : "Visit date not known"}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {document.original_filename} · {formatFileSize(document.file_size)}
          </Text>
        </View>
      </View>

      {inFlight ? (
        <View style={styles.analyzing}>
          <ActivityIndicator size="large" color={colors.patient} />
          <Text style={styles.analyzingTitle}>Analyzing your document...</Text>
          <Text style={styles.analyzingBody}>
            MedLink is reading it and writing a simple explanation. This can take up
            to a minute. You can leave this screen - it will keep working.
          </Text>
        </View>
      ) : null}

      {document.status === "FAILED" ? (
        <View style={styles.failed}>
          <Icon name="error_outline" size={32} color={colors.warning} />
          <Text style={styles.failedTitle}>We could not read this document</Text>
          <Text style={styles.failedBody}>{document.failure_reason}</Text>
          <Button
            title="Upload another record"
            icon="upload_file"
            onPress={() => router.replace("/patient/documents/upload")}
            tone="patient"
          />
        </View>
      ) : null}

      {document.status === "DONE" && summary ? (
        <>
          <DocumentDisclaimer text={document.disclaimer} />

          <Section icon="auto_awesome" title="In simple words">
            <Text style={styles.body}>{summary.plain_summary}</Text>
          </Section>

          {summary.symptoms.length > 0 ? (
            <Section icon="sick" title="Symptoms noted">
              {summary.symptoms.map((symptom) => (
                <View key={symptom} style={styles.bulletRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.bulletText}>{symptom}</Text>
                </View>
              ))}
            </Section>
          ) : null}

          {summary.medications.length > 0 ? (
            <Section icon="medication" title="Medicines and treatment">
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
            <Section icon="science" title="Test results outside the normal range">
              {summary.deficiencies.map((finding, index) => (
                <LabCard key={`low-${index}`} finding={finding} direction="low" />
              ))}
              {summary.excesses.map((finding, index) => (
                <LabCard key={`high-${index}`} finding={finding} direction="high" />
              ))}
            </Section>
          ) : null}

          {summary.key_terms.length > 0 ? (
            <Section icon="menu_book" title="Medical words explained">
              {summary.key_terms.map((term, index) => (
                <View key={`${term.term}-${index}`} style={styles.termRow}>
                  <Text style={styles.term}>{term.term}</Text>
                  <Text style={styles.termExplanation}>{term.explanation}</Text>
                </View>
              ))}
            </Section>
          ) : null}

          <Section icon="lightbulb" title="What this might mean for you">
            <Text style={styles.body}>{summary.suggested_next_steps}</Text>
            <Text style={styles.notDiagnosis}>
              This is general guidance, not a diagnosis. Only a doctor can tell you
              what is right for you.
            </Text>
          </Section>
        </>
      ) : null}

      {openError ? <ErrorBanner message={openError} /> : null}
      <Button
        title="Open the original PDF"
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
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.tile,
    backgroundColor: colors.patientTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBody: { flex: 1, minWidth: 0, gap: 2 },
  hospital: { ...type.headlineMd, color: colors.text },
  meta: { ...type.bodyMd, color: colors.muted },

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
    backgroundColor: colors.warningTint,
    borderRadius: radius.lg,
    borderWidth: 1.5,
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
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  sectionTitle: { ...type.labelLg, color: colors.text, flex: 1 },
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
    backgroundColor: colors.warningTint,
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
    borderLeftColor: colors.patientTint,
    paddingLeft: spacing.sm,
    gap: 2,
  },
  term: { ...type.labelLg, color: colors.text },
  termExplanation: { ...type.bodyMd, color: colors.muted },

  notDiagnosis: { ...type.labelMd, color: colors.muted },
});
