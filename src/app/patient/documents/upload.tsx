import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PastDateField } from "@/components/past-date-field";
import { Button, Card, ErrorBanner, Screen, TextField } from "@/components/ui";
import { api, PickedPdf } from "@/lib/api";
import { formatFileSize } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { colors, radius, spacing, type } from "@/lib/theme";

/** Mirrors the server limit, so a too-large file fails here, not after upload. */
const MAX_BYTES = 15 * 1024 * 1024;

type Picked = PickedPdf & { size?: number | null };

export default function UploadDocument() {
  const router = useRouter();
  const { session } = usePatientSession();
  const { t } = useT();

  const [file, setFile] = useState<Picked | null>(null);
  const [hospitalName, setHospitalName] = useState("");
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFile() {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      // A cache copy gives a file:// URI that FormData can upload reliably.
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_BYTES) {
      setError(t("upload.tooLarge"));
      return;
    }
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size });
  }

  async function submit() {
    if (!session || !file) return;
    setError(null);
    setUploading(true);
    try {
      const document = await api.uploadDocument(session.unique_code, file, {
        hospital_name: hospitalName,
        visit_date: visitDate ?? undefined,
      });
      // Straight to its page, which shows "Analyzing your document..." until
      // the server finishes. Replace, so Back returns to the list.
      router.replace({
        pathname: "/patient/documents/[id]",
        params: { id: String(document.id) },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("upload.failed"));
      setUploading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <View style={styles.introRow}>
          <View style={styles.introIcon}>
            <Icon name="upload_file" size={28} color={colors.patient} />
          </View>
          <View style={styles.introBody}>
            <Text style={styles.introTitle}>{t("upload.introTitle")}</Text>
            <Text style={styles.introText}>{t("upload.introText")}</Text>
          </View>
        </View>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      {file ? (
        <View style={styles.fileCard}>
          <Icon name="picture_as_pdf" size={32} color={colors.patient} />
          <View style={styles.fileBody}>
            <Text style={styles.fileName} numberOfLines={2}>
              {file.name}
            </Text>
            {file.size ? (
              <Text style={styles.fileMeta}>{formatFileSize(file.size)}</Text>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" onPress={pickFile} hitSlop={12}>
            <Text style={styles.change}>{t("upload.change")}</Text>
          </Pressable>
        </View>
      ) : (
        <Button
          title={t("upload.choose")}
          icon="picture_as_pdf"
          onPress={pickFile}
          tone="patient"
          variant="outline"
        />
      )}

      <Card style={styles.formCard}>
        <Text style={styles.optionalNote}>{t("upload.optionalNote")}</Text>
        <TextField
          label={t("upload.hospital")}
          requirement={t("common.optional")}
          value={hospitalName}
          onChangeText={setHospitalName}
          placeholder={t("upload.hospitalPlaceholder")}
          autoCapitalize="words"
        />
        <PastDateField
          label={t("upload.visitDate")}
          requirement={t("common.optional")}
          value={visitDate}
          onChange={setVisitDate}
          onClear={() => setVisitDate(null)}
          icon="event"
          placeholder={t("upload.visitPlaceholder")}
          hint={t("upload.visitHint")}
        />
      </Card>

      <View style={styles.timingNote}>
        <Icon name="schedule" size={20} color={colors.muted} />
        <Text style={styles.timingText}>{t("upload.timing")}</Text>
      </View>

      <Button
        title={t("upload.submit")}
        icon="cloud_upload"
        onPress={submit}
        loading={uploading}
        disabled={!file}
        tone="patient"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  introRow: { flexDirection: "row", gap: spacing.sm },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.patientTint,
    alignItems: "center",
    justifyContent: "center",
  },
  introBody: { flex: 1, gap: spacing.xs },
  introTitle: { ...type.headlineMd, color: colors.text },
  introText: { ...type.bodyMd, color: colors.muted },

  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.patientTint,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.patient,
    padding: spacing.md,
  },
  fileBody: { flex: 1, minWidth: 0 },
  fileName: { ...type.labelLg, color: colors.text },
  fileMeta: { ...type.labelMd, color: colors.muted },
  change: { ...type.labelLg, color: colors.patient },

  formCard: { gap: spacing.md },
  optionalNote: { ...type.bodyMd, color: colors.muted },

  timingNote: { flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.xs },
  timingText: { ...type.bodyMd, color: colors.muted, flex: 1 },
});
