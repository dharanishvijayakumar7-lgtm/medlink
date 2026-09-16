import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { DocumentDisclaimer } from "@/components/document-disclaimer";
import { Icon } from "@/components/icon";
import {
  Button,
  EmptyState,
  ErrorBanner,
  IconCircle,
  InfoNote,
  Loading,
  Screen,
  SoftBadge,
  Tone,
} from "@/components/ui";
import { api, DocumentStatus, isDocumentInFlight, MedicalDocument } from "@/lib/api";
import { formatIsoDate, timeAgo } from "@/lib/format";
import { translate, TranslationKey, useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";
import { useTranslated } from "@/lib/use-translated";

/** How often to check on documents still being read. */
const POLL_MS = 4_000;

const STATUS_META: Record<DocumentStatus, { label: TranslationKey; tone: Tone }> = {
  PENDING: { label: "documents.analyzing", tone: "patient" },
  PROCESSING: { label: "documents.analyzing", tone: "patient" },
  DONE: { label: "documents.ready", tone: "success" },
  FAILED: { label: "timeline.couldNotRead", tone: "warning" },
};

function DocumentCard({
  document,
  onPress,
}: {
  document: MedicalDocument;
  onPress: () => void;
}) {
  const { t } = useT();
  const meta = STATUS_META[document.status];
  const inFlight = isDocumentInFlight(document);
  const {
    texts: [failure, summary],
  } = useTranslated([
    document.failure_reason ?? "",
    document.extracted_summary?.plain_summary ?? "",
  ]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <IconCircle icon="picture_as_pdf" size={52} />
        <View style={styles.cardHeading}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {document.hospital_name ?? document.original_filename}
          </Text>
          <Text style={styles.cardMeta}>
            {document.visit_date
              ? t("document.visit", { date: formatIsoDate(document.visit_date) })
              : t("document.visitUnknown")}
            {" · "}
            {t("documents.uploaded", { time: timeAgo(document.uploaded_at) })}
          </Text>
        </View>
        <Icon name="chevron_right" size={28} color={colors.faint} />
      </View>

      <SoftBadge label={t(meta.label)} tone={meta.tone} />

      {inFlight ? (
        <View style={styles.inFlightRow}>
          <ActivityIndicator size="small" color={colors.patient} />
          <Text style={styles.inFlightText}>{t("document.analyzing")}</Text>
        </View>
      ) : document.status === "FAILED" ? (
        <Text style={styles.failedText}>{failure}</Text>
      ) : document.extracted_summary ? (
        <Text style={styles.summaryText} numberOfLines={2}>
          {summary}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function MyDocuments() {
  const router = useRouter();
  const { session } = usePatientSession();
  const { t } = useT();
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
      setError(caught instanceof Error ? caught.message : translate("documents.loadFailed"));
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
    return <Loading label={t("documents.loading")} />;
  }

  const anyReady = documents.some((document) => document.status === "DONE");

  return (
    <Screen
      refreshing={loading}
      onRefresh={refresh}
      footer={
        <Button
          title={t("nav.patient.upload")}
          icon="upload_file"
          onPress={() => router.push("/patient/documents/upload")}
          tone="patient"
        />
      }
    >
      <InfoNote icon="menu_book" tone="patient" text={t("documents.explainer")} />

      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

      {anyReady ? (
        // Compact: only the translated lead line is shown.
        <DocumentDisclaimer text={documents[0].disclaimer} compact />
      ) : null}

      {documents.length === 0 ? (
        <EmptyState
          icon="upload_file"
          title={t("documents.emptyTitle")}
          body={t("documents.emptyBody")}
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

  card: {
    ...elevation.level1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardHeading: { flex: 1, minWidth: 0 },
  cardTitle: { ...type.headlineMd, color: colors.text },
  cardMeta: { ...type.labelMd, fontFamily: type.bodyLg.fontFamily, color: colors.muted },

  inFlightRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  inFlightText: { ...type.bodyMd, color: colors.patient },
  failedText: { ...type.bodyMd, color: colors.text },
  summaryText: { ...type.bodyLg, color: colors.text },
});
