import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { DocumentDisclaimer } from "@/components/document-disclaimer";
import { Icon } from "@/components/icon";
import {
  Button,
  EmptyState,
  ErrorBanner,
  Loading,
  Screen,
  SoftBadge,
  Tone,
} from "@/components/ui";
import { api, DocumentStatus, isDocumentInFlight, MedicalDocument } from "@/lib/api";
import { formatIsoDate, timeAgo } from "@/lib/format";
import { usePatientSession } from "@/lib/patient-session";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";

/** How often to check on documents still being read. */
const POLL_MS = 4_000;

const STATUS_META: Record<DocumentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "ANALYZING", tone: "patient" },
  PROCESSING: { label: "ANALYZING", tone: "patient" },
  DONE: { label: "READY", tone: "success" },
  FAILED: { label: "COULD NOT READ", tone: "warning" },
};

function DocumentCard({
  document,
  onPress,
}: {
  document: MedicalDocument;
  onPress: () => void;
}) {
  const meta = STATUS_META[document.status];
  const inFlight = isDocumentInFlight(document);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.fileIcon}>
          <Icon name="picture_as_pdf" size={28} color={colors.patient} />
        </View>
        <View style={styles.cardHeading}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {document.hospital_name ?? document.original_filename}
          </Text>
          <Text style={styles.cardMeta}>
            {document.visit_date
              ? `Visit ${formatIsoDate(document.visit_date)}`
              : "Visit date not known"}
            {" · "}uploaded {timeAgo(document.uploaded_at)}
          </Text>
        </View>
        <Icon name="chevron_right" size={24} color={colors.faint} />
      </View>

      <SoftBadge label={meta.label} tone={meta.tone} />

      {inFlight ? (
        <View style={styles.inFlightRow}>
          <ActivityIndicator size="small" color={colors.patient} />
          <Text style={styles.inFlightText}>Analyzing your document...</Text>
        </View>
      ) : document.status === "FAILED" ? (
        <Text style={styles.failedText}>{document.failure_reason}</Text>
      ) : document.extracted_summary ? (
        <Text style={styles.summaryText} numberOfLines={2}>
          {document.extracted_summary.plain_summary}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function MyDocuments() {
  const router = useRouter();
  const { session } = usePatientSession();
  const code = session?.unique_code ?? "";

  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // No synchronous setState, so it is safe from effects and the poll timer.
  const fetchDocuments = useCallback(async () => {
    if (!code) return;
    try {
      setDocuments(await api.listDocuments(code));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your documents.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchDocuments();
  }, [fetchDocuments]);

  useFocusEffect(
    useCallback(() => {
      fetchDocuments();
    }, [fetchDocuments]),
  );

  // Poll only while something is still being read, then stop.
  const anyInFlight = documents.some(isDocumentInFlight);
  useEffect(() => {
    if (!anyInFlight) return;
    const timer = setInterval(fetchDocuments, POLL_MS);
    return () => clearInterval(timer);
  }, [anyInFlight, fetchDocuments]);

  if (loading && documents.length === 0) {
    return <Loading label="Loading your documents..." />;
  }

  const anyReady = documents.some((document) => document.status === "DONE");

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Icon name="description" size={24} color={colors.onPatient} />
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle}>My Documents</Text>
          <Text style={styles.headerSubtitle}>
            Records from other hospitals and clinics
          </Text>
        </View>
      </View>

      <View style={styles.explainer}>
        <Icon name="menu_book" size={22} color={colors.patient} />
        <Text style={styles.explainerText}>
          Upload a discharge summary, prescription or lab report and MedLink
          explains it in simple words. These stay separate from My Record - your
          doctor sees both together.
        </Text>
      </View>

      <Button
        title="Upload a record"
        icon="upload_file"
        onPress={() => router.push("/patient/documents/upload")}
        tone="patient"
      />

      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

      {anyReady ? (
        <DocumentDisclaimer text={documents[0].disclaimer} compact />
      ) : null}

      {documents.length === 0 ? (
        <EmptyState
          icon="upload_file"
          title="No documents yet"
          body="Upload a record from any hospital visit - one document for each visit."
        />
      ) : (
        documents.map((document) => (
          <DocumentCard
            key={document.id}
            document={document}
            onPress={() =>
              router.push({
                pathname: "/patient/documents/[id]",
                params: { id: String(document.id) },
              })
            }
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9 },

  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBody: { flex: 1 },
  headerTitle: { ...type.headlineMd, color: colors.text },
  headerSubtitle: { ...type.bodyMd, color: colors.muted },

  explainer: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  explainerText: { ...type.bodyLg, color: colors.text, flex: 1 },

  card: {
    ...elevation.level1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.tile,
    backgroundColor: colors.patientTint,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeading: { flex: 1, minWidth: 0 },
  cardTitle: { ...type.headlineMd, color: colors.text },
  cardMeta: { ...type.labelMd, color: colors.muted },

  inFlightRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  inFlightText: { ...type.bodyMd, color: colors.patient },
  failedText: { ...type.bodyMd, color: colors.text },
  summaryText: { ...type.bodyLg, color: colors.text },
});
