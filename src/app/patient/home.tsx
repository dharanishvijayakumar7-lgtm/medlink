import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DateOfBirthPrompt } from "@/components/date-of-birth-prompt";
import { Icon } from "@/components/icon";
import { Badge, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, Consultation, PatientRecord } from "@/lib/api";
import { ageShort, genderLabel } from "@/lib/format";
import { translate, useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { dismissDobPrompt, isDobPromptDismissed } from "@/lib/storage";
import { colors, elevation, overlay, radius, spacing, touch, type } from "@/lib/theme";

/** How often to check for a doctor starting a call. Push comes in a later part. */
const POLL_MS = 10_000;

/** India's unified emergency number, as wired in Part 1. */
const EMERGENCY_NUMBER = "112";

function ActionTile({
  icon,
  title,
  subtitle,
  tint,
  iconColor,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  tint: string;
  iconColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, { backgroundColor: tint }]}>
          <Icon name={icon} size={28} color={iconColor} />
        </View>
        <Icon name="chevron_right" size={20} color={colors.faint} />
      </View>
      <View>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

export default function PatientHome() {
  const router = useRouter();
  const { session, forget } = usePatientSession();
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

  async function startOver() {
    await forget();
    router.replace("/patient/sign-in");
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
  // Patients registered before date of birth existed are asked once. Skipping
  // hides the card for good; it can still be reopened from the ID card.
  const missingDob = record !== null && record.date_of_birth === null;
  const showDobPrompt = missingDob && dobPromptDismissed === false;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.greeting}>
        {record ? (
          <Text style={styles.unit}>{record.village.toUpperCase()}</Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>
          {t("home.greeting", { name: record?.name ?? t("home.greetingFallback") })}
        </Text>
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {pending ? (
        <Pressable
          accessibilityRole="button"
          onPress={joinCall}
          style={({ pressed }) => [styles.callBanner, pressed && styles.pressed]}
        >
          <View style={styles.callIcon}>
            <Icon name="videocam" size={28} color={colors.onSuccess} />
          </View>
          <View style={styles.callBody}>
            <Text style={styles.callTitle}>
              {t("home.callReady", { name: pending.doctor_name })}
            </Text>
            <Text style={styles.callSubtitle}>{t("home.callTap")}</Text>
          </View>
          <View style={styles.callAction}>
            <Text style={styles.callActionText}>{t("home.join")}</Text>
          </View>
        </Pressable>
      ) : null}

      {/* Digital Health Identity */}
      <View style={styles.idCard}>
        <View style={styles.idHeader}>
          <View style={styles.idHeaderLeft}>
            <Icon name="badge" size={20} color={colors.patient} />
            <Text style={styles.idLabel}>{t("home.idLabel")}</Text>
          </View>
          <Badge label={t("home.verified")} tone="patient" />
        </View>
        <View style={styles.idRow}>
          <View style={styles.idBody}>
            <Text style={styles.idValue} selectable>
              {code}
            </Text>
            {record ? (
              <Text style={styles.idMeta} numberOfLines={1}>
                {record.name} · {ageShort(record.age_label)} ·{" "}
                {genderLabel(record.gender)}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("home.copyId")}
            onPress={copyCode}
            style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
          >
            <Icon
              name={copied ? "check" : "content_copy"}
              size={20}
              color={colors.patient}
            />
            <Text style={styles.copyText}>{copied ? t("home.copied") : t("home.copy")}</Text>
          </Pressable>
        </View>
      </View>

      {missingDob && dobPromptDismissed ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setDobPromptDismissed(false)}
          style={styles.addDob}
          hitSlop={12}
        >
          <Icon name="cake" size={18} color={colors.patient} />
          <Text style={styles.addDobText}>{t("dob.title")}</Text>
        </Pressable>
      ) : null}

      {showDobPrompt && record ? (
        <DateOfBirthPrompt
          uniqueCode={record.unique_code}
          onSaved={() => load()}
          onSkip={skipDobPrompt}
        />
      ) : null}

      {/* Primary action */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/patient/symptom-check")}
        style={({ pressed }) => [styles.primaryCard, pressed && styles.pressed]}
      >
        <View style={styles.primaryTop}>
          <View style={styles.primaryTile}>
            <Icon name="stethoscope" size={36} color={colors.onPrimary} />
          </View>
          <View style={styles.primaryArrow}>
            <Icon name="arrow_forward" size={24} color={colors.onPrimary} />
          </View>
        </View>
        <View style={styles.primaryFlag}>
          <Text style={styles.primaryFlagText}>{t("home.symptomFlag")}</Text>
        </View>
        <Text style={styles.primaryTitle}>{t("home.symptomTitle")}</Text>
        <Text style={styles.primaryBody}>{t("home.symptomBody")}</Text>
      </Pressable>

      {/* Live queue position */}
      {position !== null ? (
        <View style={styles.snapshot}>
          <View style={styles.snapshotIcon}>
            <Icon name="schedule" size={28} color={colors.patient} />
          </View>
          <View style={styles.snapshotBody}>
            <Text style={styles.snapshotLabel}>{t("home.queueLabel")}</Text>
            <Text style={styles.snapshotValue}>
              {t("home.queueNumber", { position })}
            </Text>
            <Text style={styles.snapshotMeta}>
              {position === 1
                ? t("home.queueNext")
                : t("home.queueAhead", { count: position - 1 })}
            </Text>
          </View>
        </View>
      ) : null}

      {flagged ? (
        <View style={styles.flagCard}>
          <Icon name="warning" size={28} color={colors.warning} />
          <View style={styles.flagBody}>
            <Text style={styles.flagTitle}>{t("home.flaggedTitle")}</Text>
            <Text style={styles.flagText}>
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

      {/* Two-column action tiles */}
      <View style={styles.tileRow}>
        <ActionTile
          icon="folder_shared"
          title={t("home.recordTitle")}
          subtitle={t("home.recordSubtitle")}
          tint={colors.patientTint}
          iconColor={colors.patient}
          onPress={() => router.push("/patient/record")}
        />
        <ActionTile
          icon="local_hospital"
          title={t("home.facilitiesTitle")}
          subtitle={t("home.facilitiesSubtitle")}
          tint={colors.secondaryContainer}
          iconColor={colors.doctor}
          onPress={() => router.push("/patient/facilities")}
        />
      </View>

      {/* Outside records - its own row, kept apart from My Record on purpose. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/patient/documents")}
        style={({ pressed }) => [styles.wideTile, pressed && styles.pressed]}
      >
        <View style={[styles.tileIcon, { backgroundColor: colors.patientTint }]}>
          <Icon name="description" size={28} color={colors.patient} />
        </View>
        <View style={styles.wideTileBody}>
          <Text style={styles.tileTitle}>{t("home.documentsTitle")}</Text>
          <Text style={styles.tileSubtitle}>{t("home.documentsSubtitle")}</Text>
        </View>
        <Icon name="chevron_right" size={24} color={colors.faint} />
      </Pressable>

      {/* Calls to the voice agent, matched to the registered phone number. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/patient/calls")}
        style={({ pressed }) => [styles.wideTile, pressed && styles.pressed]}
      >
        <View style={[styles.tileIcon, { backgroundColor: colors.patientTint }]}>
          <Icon name="phone_in_talk" size={28} color={colors.patient} />
        </View>
        <View style={styles.wideTileBody}>
          <Text style={styles.tileTitle}>{t("home.callsTitle")}</Text>
          <Text style={styles.tileSubtitle}>{t("home.callsSubtitle")}</Text>
        </View>
        <Icon name="chevron_right" size={24} color={colors.faint} />
      </Pressable>

      {/* Emergency SOS - the only red in the app */}
      <View style={styles.sosCard}>
        <View style={styles.sosTop}>
          <View style={styles.sosIcon}>
            <Icon name="emergency" size={32} color={colors.onEmergency} />
          </View>
          <View style={styles.sosBody}>
            <Text style={styles.sosTitle}>{t("home.sosTitle")}</Text>
            <Text style={styles.sosText}>{t("home.sosText")}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/patient/sos")}
          style={({ pressed }) => [styles.sosButton, pressed && styles.pressed]}
        >
          <Icon name="call" size={28} color={colors.emergency} />
          <Text style={styles.sosButtonText}>
            {t("home.sosButton", { number: EMERGENCY_NUMBER })}
          </Text>
        </Pressable>
        <View style={styles.sosFooter}>
          <Text style={styles.sosFooterText}>{t("home.sosHotline")}</Text>
          <Text style={styles.sosFooterText}>{t("home.sosGps")}</Text>
        </View>
      </View>

      <Pressable onPress={startOver} style={styles.startOver} hitSlop={12}>
        <Text style={styles.startOverText}>{t("home.startOver")}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9 },

  greeting: { gap: spacing.xs },
  unit: { ...type.labelMd, color: colors.patient, letterSpacing: 0.8 },
  name: { ...type.headlineXlMobile, color: colors.text },

  callBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.success,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  callIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: overlay.onColorFill,
    alignItems: "center",
    justifyContent: "center",
  },
  callBody: { flex: 1, gap: 2 },
  callTitle: { ...type.labelLg, color: colors.onSuccess },
  callSubtitle: { ...type.labelMd, color: overlay.onColorText },
  callAction: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  callActionText: { ...type.labelLg, color: colors.success },

  idCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  idHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  idHeaderLeft: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  idLabel: { ...type.labelMd, color: colors.muted },
  idRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  idBody: { flex: 1, minWidth: 0 },
  idValue: { ...type.headlineLg, color: colors.text, letterSpacing: 1.5 },
  idMeta: { ...type.bodyMd, color: colors.muted },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: touch.min,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
  },
  copyText: { ...type.labelMd, color: colors.patient },

  primaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  primaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryTile: {
    width: 56,
    height: 56,
    borderRadius: radius.tile,
    backgroundColor: overlay.onColorFill,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryArrow: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: overlay.onColorFill,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryFlag: {
    alignSelf: "flex-start",
    backgroundColor: overlay.onColorFill,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryFlagText: { ...type.labelMd, color: colors.onPrimary, letterSpacing: 0.8 },
  primaryTitle: { ...type.headlineLg, color: colors.onPrimary },
  primaryBody: { ...type.bodyMd, color: colors.onPrimaryContainer },

  snapshot: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  snapshotIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  snapshotBody: { flex: 1, minWidth: 0 },
  snapshotLabel: { ...type.labelMd, color: colors.muted },
  snapshotValue: { ...type.headlineMd, color: colors.text },
  snapshotMeta: { ...type.bodyMd, color: colors.muted },

  flagCard: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.warningTint,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.warning,
    padding: spacing.md,
  },
  flagBody: { flex: 1, gap: 2 },
  flagTitle: { ...type.labelLg, color: colors.text },
  flagText: { ...type.bodyMd, color: colors.text },
  flagMeta: { ...type.labelMd, color: colors.muted },

  tileRow: { flexDirection: "row", gap: spacing.md },
  wideTile: {
    ...elevation.level1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: touch.row,
  },
  wideTileBody: { flex: 1, minWidth: 0 },
  addDob: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    minHeight: touch.min,
  },
  addDobText: { ...type.labelLg, color: colors.patient },
  tile: {
    ...elevation.level1,
    flex: 1,
    minHeight: 176,
    borderRadius: radius.lg,
    padding: spacing.md,
    justifyContent: "space-between",
  },
  tileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.tile,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: { ...type.headlineMd, color: colors.text },
  tileSubtitle: { ...type.bodyMd, color: colors.muted, marginTop: 2 },

  sosCard: {
    backgroundColor: colors.emergency,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sosTop: { flexDirection: "row", gap: spacing.md },
  sosIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: overlay.onColorFill,
    alignItems: "center",
    justifyContent: "center",
  },
  sosBody: { flex: 1, minWidth: 0, gap: spacing.xs },
  sosTitle: { ...type.headlineLg, color: colors.onEmergency, letterSpacing: 0.5 },
  sosText: { ...type.bodyMd, color: overlay.onColorText },
  sosButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: touch.sos,
    backgroundColor: colors.card,
    borderRadius: radius.md,
  },
  sosButtonText: { ...type.headlineMd, color: colors.emergency },
  sosFooter: { flexDirection: "row", justifyContent: "space-between" },
  sosFooterText: { ...type.labelMd, color: overlay.onColorText },

  startOver: { alignItems: "center", paddingVertical: spacing.md },
  startOverText: { ...type.labelMd, color: colors.faint },
});
