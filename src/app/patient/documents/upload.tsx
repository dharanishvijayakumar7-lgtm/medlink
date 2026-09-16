import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PastDateField } from "@/components/past-date-field";
import {
  Button,
  Card,
  ErrorBanner,
  IconCircle,
  InfoNote,
  Screen,
  TextField,
} from "@/components/ui";
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
      // No cache copy: the picker's content:// URI is what expo-file-system
      // may read. In Expo Go the copy lands outside the folders it is allowed
      // to read, and the upload fails with "Missing 'READ' permission".
      copyToCacheDirectory: false,
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
    <Screen
      footer={
        <>
          {error ? <ErrorBanner message={error} /> : null}
          <Button
            title={t("upload.submit")}
            icon="cloud_upload"
            onPress={submit}
            loading={uploading}
            disabled={!file}
            tone="patient"
          />
        </>
      }
    >
      <Text style={styles.intro}>{t("upload.introText")}</Text>

      {file ? (
        <View style={styles.fileCard}>
          <IconCircle icon="picture_as_pdf" size={52} />
          <View style={styles.fileBody}>
            <Text style={styles.fileName} numberOfLines={2}>
              {file.name}
            </Text>
            {file.size ? (
              <Text style={styles.fileMeta}>{formatFileSize(file.size)}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={pickFile}
            hitSlop={12}
            style={styles.changeButton}
          >
            <Text style={styles.change}>{t("upload.change")}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={pickFile}
          style={({ pressed }) => [styles.pickTile, pressed && styles.pressed]}
        >
          <IconCircle icon="upload_file" size={72} />
          <Text style={styles.pickTitle}>{t("upload.choose")}</Text>
        </Pressable>
      )}

      <Card style={styles.formCard}>
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

      <InfoNote icon="schedule" text={t("upload.timing")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.patientSoft },
  intro: { ...type.bodyLg, color: colors.muted },

  pickTile: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 180,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.patient,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  pickTitle: { ...type.headlineMd, color: colors.patient, textAlign: "center" },

  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.patientSoft,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.patient,
    padding: spacing.md,
  },
  fileBody: { flex: 1, minWidth: 0 },
  fileName: { ...type.labelLg, color: colors.text },
  fileMeta: { ...type.labelMd, color: colors.muted },
  changeButton: { minHeight: 44, justifyContent: "center" },
  change: { ...type.labelLg, color: colors.patient },

  formCard: { gap: spacing.md },
});
