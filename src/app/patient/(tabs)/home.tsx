import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DateOfBirthPrompt } from "@/components/date-of-birth-prompt";
import { Icon } from "@/components/icon";
import { ActionTile, ErrorBanner, IconCircle, Loading, Screen } from "@/components/ui";
import { api, Consultation, PatientRecord } from "@/lib/api";
import { translate, useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { dismissDobPrompt, isDobPromptDismissed } from "@/lib/storage";
import { colors, overlay, radius, spacing, touch, type } from "@/lib/theme";

/** How often to check for a doctor starting a call. */
const POLL_MS = 10_000;

/** India's unified emergency number. */
const EMERGENCY_NUMBER = "112";

export default function PatientHome() {
  const router = useRouter();
  const { session } = usePatientSession();
  const { t } = useT();

  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [pending, setPending] = useState<Consultation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  // null until read from storage, so the prompt never flashes up then vanishes.
  const [dobPromptDismissed, setDobPromptDismissed] = useState<boolean | null>(null);

  const code = session?.unique_code ?? "";

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      setRecord(await api.getPatientRecord(code));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : translate("home.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [code]);

  // Kept separate from load() so the 10s poll never flickers the whole screen.
  const checkForCall = useCallback(async () => {
    if (!code) return;
    try {
      setPending(await api.getPendingConsultation(code));
    } catch {
      // A failed poll is not worth surfacing; the next one will retry.
    }
  }, [code]);

  useFocusEffect(
    useCallback(() => {
      load();
      checkForCall();
      if (code) isDobPromptDismissed(code).then(setDobPromptDismissed);
      const timer = setInterval(checkForCall, POLL_MS);
      return () => clearInterval(timer);
    }, [load, checkForCall, code]),
  );

  async function copyCode() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function skipDobPrompt() {
    setDobPromptDismissed(true);
    await dismissDobPrompt(code);
  }

  function joinCall() {
    if (!pending) return;
    router.push({
      pathname: "/call",
      params: {
        token: pending.token,
        serverUrl: pending.livekit_url,
        roomName: pending.room_name,
        peerName: t("common.doctorName", { name: pending.doctor_name }),
        consultationId: String(pending.id),
        role: "patient",
      },
    });
  }

  if (loading && !record) {
    return <Loading label={t("home.loading")} />;
  }

  const flagged = record?.notes.find((note) => note.is_high_risk) ?? null;
  const position = record?.queue_position ?? null;
  // Patients registered before date of birth existed are asked once.
  const showDobPrompt =
    record !== null && record.date_of_birth === null && dobPromptDismissed === false;

  return (
    <Screen safeTop refreshing={loading} onRefresh={load}>
      <View style={styles.greeting}>
        <Text style={styles.hello} numberOfLines={2} accessibilityRole="header">
          {t("home.greeting", { name: record?.name ?? t("home.greetingFallback") })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("home.copyId")}
          onPress={copyCode}
          style={({ pressed }) => [styles.idChip, pressed && styles.pressed]}
        >
          <Text style={styles.idChipLabel}>{t("home.idLabel")}</Text>
          <Text style={styles.idChipValue} selectable>
            {code}
          </Text>
          <Icon
            name={copied ? "check" : "content_copy"}
            size={20}
            color={colors.patient}
          />
        </Pressable>
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {pending ? (
        <Pressable
          accessibilityRole="button"
          onPress={joinCall}
          style={({ pressed }) => [styles.callBanner, pressed && styles.pressed]}
        >
          <IconCircle icon="videocam" tone="success" size={52} solid />
          <View style={styles.flex}>
            <Text style={styles.callTitle}>
              {t("home.callReady", { name: pending.doctor_name })}
            </Text>
          </View>
          <View style={styles.callAction}>
            <Text style={styles.callActionText}>{t("home.join")}</Text>
          </View>
        </Pressable>
      ) : null}

      {showDobPrompt && record ? (
        <DateOfBirthPrompt
          uniqueCode={record.unique_code}
          onSaved={() => load()}
          onSkip={skipDobPrompt}
        />
      ) : null}

      {/* The one main action */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/patient/symptom-check")}
        style={({ pressed }) => [styles.primaryCard, pressed && styles.pressed]}
      >
        <View style={styles.primaryIcon}>
          <Icon name="stethoscope" size={40} color={colors.onPrimary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.primaryTitle}>{t("home.symptomTitle")}</Text>
          <Text style={styles.primaryBody}>{t("home.symptomBody")}</Text>
        </View>
        <Icon name="arrow_forward" size={32} color={colors.onPrimary} />
      </Pressable>

      {position !== null ? (
        <View style={styles.statusCard}>
          <IconCircle icon="schedule" size={52} />
          <View style={styles.flex}>
            <Text style={styles.statusTitle}>
              {t("home.queueNumber", { position })}
            </Text>
            <Text style={styles.statusText}>
              {position === 1
                ? t("home.queueNext")
                : t("home.queueAhead", { count: position - 1 })}
            </Text>
          </View>
        </View>
      ) : null}

      {flagged ? (
        <View style={styles.flagCard}>
          <IconCircle icon="warning" tone="warning" size={52} />
          <View style={styles.flex}>
            <Text style={styles.statusTitle}>{t("home.flaggedTitle")}</Text>
            <Text style={styles.statusText}>
              {flagged.high_risk_reason?.trim()
                ? flagged.high_risk_reason
                : t("home.flaggedFallback")}
            </Text>
            <Text style={styles.flagMeta}>
              {t("common.doctorName", { name: flagged.doctor.name })}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.tileRow}>
        <ActionTile
          icon="folder_shared"
          title={t("home.recordTitle")}
          onPress={() => router.push("/patient/record")}
        />
        <ActionTile
          icon="upload_file"
          title={t("home.documentsTitle")}
          onPress={() => router.push("/patient/documents")}
        />
      </View>

      {/* Emergency - the only red in the app */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/patient/sos")}
        style={({ pressed }) => [styles.sosButton, pressed && styles.pressed]}
      >
        <IconCircle icon="emergency" tone="emergency" size={52} />
        <View style={styles.flex}>
          <Text style={styles.sosTitle}>{t("home.sosTitle")}</Text>
          <Text style={styles.sosText}>
            {t("home.sosButton", { number: EMERGENCY_NUMBER })}
          </Text>
        </View>
        <Icon name="call" size={32} color={colors.onEmergency} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.88 },
  flex: { flex: 1, minWidth: 0, gap: 2 },

  greeting: { gap: spacing.sm, marginBottom: spacing.xs },
  hello: { ...type.headlineXlMobile, color: colors.text },
  idChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.sm,
    minHeight: touch.min,
    backgroundColor: colors.patientSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  idChipLabel: { ...type.labelMd, fontFamily: type.bodyLg.fontFamily, color: colors.muted },
  idChipValue: { ...type.labelLg, color: colors.text, letterSpacing: 1 },

  callBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.successSoft,
    borderWidth: 2,
    borderColor: colors.success,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  callTitle: { ...type.labelLg, color: colors.text },
  callAction: {
    backgroundColor: colors.success,
    borderRadius: radius.md,
    minHeight: touch.min,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  callActionText: { ...type.labelLg, color: colors.onSuccess },

  primaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 132,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  primaryIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: overlay.onColorFill,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryTitle: { ...type.headlineLg, color: colors.onPrimary },
  primaryBody: { ...type.bodyLg, fontSize: 17, color: overlay.onColorText },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  statusTitle: { ...type.labelLg, color: colors.text },
  statusText: { ...type.bodyLg, fontSize: 17, color: colors.muted },

  flagCard: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  flagMeta: { ...type.labelMd, color: colors.muted },

  tileRow: { flexDirection: "row", gap: spacing.md },

  sosButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 96,
    backgroundColor: colors.emergency,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  sosTitle: { ...type.headlineMd, color: colors.onEmergency },
  sosText: { ...type.bodyLg, fontSize: 17, color: overlay.onColorText },
});
