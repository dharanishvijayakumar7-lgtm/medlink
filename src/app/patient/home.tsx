import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { Badge, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, Consultation, PatientRecord } from "@/lib/api";
import { usePatientSession } from "@/lib/patient-session";
import { colors, elevation, radius, spacing, touch, type } from "@/lib/theme";

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

  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [pending, setPending] = useState<Consultation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const code = session?.unique_code ?? "";

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      setRecord(await api.getPatientRecord(code));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your record.");
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
      const timer = setInterval(checkForCall, POLL_MS);
      return () => clearInterval(timer);
    }, [load, checkForCall]),
  );

  async function copyCode() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function startOver() {
    await forget();
    router.replace("/patient/register");
  }

  function joinCall() {
    if (!pending) return;
    router.push({
      pathname: "/call",
      params: {
        token: pending.token,
        serverUrl: pending.livekit_url,
        roomName: pending.room_name,
        peerName: `Dr. ${pending.doctor_name}`,
        consultationId: String(pending.id),
        role: "patient",
      },
    });
  }

  if (loading && !record) {
    return <Loading label="Loading your record..." />;
  }

  const flagged = record?.notes.find((note) => note.is_high_risk) ?? null;
  const position = record?.queue_position ?? null;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.greeting}>
        {record ? (
          <Text style={styles.unit}>{record.village.toUpperCase()}</Text>
        ) : null}
        <Text style={styles.name} numberOfLines={1}>
          Namaste, {record?.name ?? "there"}
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
            <Text style={styles.callTitle}>Dr. {pending.doctor_name} is ready</Text>
            <Text style={styles.callSubtitle}>Tap to join your consultation now</Text>
          </View>
          <View style={styles.callAction}>
            <Text style={styles.callActionText}>Join</Text>
          </View>
        </Pressable>
      ) : null}

      {/* Digital Health Identity */}
      <View style={styles.idCard}>
        <View style={styles.idHeader}>
          <View style={styles.idHeaderLeft}>
            <Icon name="badge" size={20} color={colors.patient} />
            <Text style={styles.idLabel}>Digital Health Identity</Text>
          </View>
          <Badge label="VERIFIED" tone="patient" />
        </View>
        <View style={styles.idRow}>
          <View style={styles.idBody}>
            <Text style={styles.idValue} selectable>
              {code}
            </Text>
            {record ? (
              <Text style={styles.idMeta} numberOfLines={1}>
                {record.name} · {record.age} Yrs · {record.gender}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy Health ID"
            onPress={copyCode}
            style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
          >
            <Icon
              name={copied ? "check" : "content_copy"}
              size={20}
              color={colors.patient}
            />
            <Text style={styles.copyText}>{copied ? "Copied" : "Copy"}</Text>
          </Pressable>
        </View>
      </View>

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
          <Text style={styles.primaryFlagText}>GUIDED SYMPTOM ASSESSMENT</Text>
        </View>
        <Text style={styles.primaryTitle}>Start Symptom Check</Text>
        <Text style={styles.primaryBody}>
          Answer a few questions about how you feel. A doctor reviews every answer.
        </Text>
      </Pressable>

      {/* Live queue position */}
      {position !== null ? (
        <View style={styles.snapshot}>
          <View style={styles.snapshotIcon}>
            <Icon name="schedule" size={28} color={colors.patient} />
          </View>
          <View style={styles.snapshotBody}>
            <Text style={styles.snapshotLabel}>Your place in the queue</Text>
            <Text style={styles.snapshotValue}>Number {position}</Text>
            <Text style={styles.snapshotMeta}>
              {position === 1
                ? "You are next. Keep your phone nearby."
                : `${position - 1} ${position === 2 ? "person is" : "people are"} ahead of you.`}
            </Text>
          </View>
        </View>
      ) : null}

      {flagged ? (
        <View style={styles.flagCard}>
          <Icon name="warning" size={28} color={colors.warning} />
          <View style={styles.flagBody}>
            <Text style={styles.flagTitle}>A doctor flagged you for follow-up</Text>
            <Text style={styles.flagText}>
              {flagged.high_risk_reason?.trim()
                ? flagged.high_risk_reason
                : "Open My record for the full note."}
            </Text>
            <Text style={styles.flagMeta}>Dr. {flagged.doctor.name}</Text>
          </View>
        </View>
      ) : null}

      {/* Two-column action tiles */}
      <View style={styles.tileRow}>
        <ActionTile
          icon="folder_shared"
          title="My Record"
          subtitle="Past visits & notes"
          tint={colors.patientTint}
          iconColor={colors.patient}
          onPress={() => router.push("/patient/record")}
        />
        <ActionTile
          icon="local_hospital"
          title="Facilities"
          subtitle="Clinics & hospitals"
          tint={colors.secondaryContainer}
          iconColor={colors.doctor}
          onPress={() => router.push("/patient/facilities")}
        />
      </View>

      {/* Emergency SOS - the only red in the app */}
      <View style={styles.sosCard}>
        <View style={styles.sosTop}>
          <View style={styles.sosIcon}>
            <Icon name="emergency" size={32} color={colors.onEmergency} />
          </View>
          <View style={styles.sosBody}>
            <Text style={styles.sosTitle}>EMERGENCY SOS</Text>
            <Text style={styles.sosText}>
              Open for the emergency number and your exact location
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/patient/sos")}
          style={({ pressed }) => [styles.sosButton, pressed && styles.pressed]}
        >
          <Icon name="call" size={28} color={colors.emergency} />
          <Text style={styles.sosButtonText}>
            Emergency help ({EMERGENCY_NUMBER})
          </Text>
        </Pressable>
        <View style={styles.sosFooter}>
          <Text style={styles.sosFooterText}>Toll-free government hotline</Text>
          <Text style={styles.sosFooterText}>GPS location shown</Text>
        </View>
      </View>

      <Pressable onPress={startOver} style={styles.startOver} hitSlop={12}>
        <Text style={styles.startOverText}>Not you? Register a different patient</Text>
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
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  callBody: { flex: 1, gap: 2 },
  callTitle: { ...type.labelLg, color: colors.onSuccess },
  callSubtitle: { ...type.labelMd, color: "rgba(255,255,255,0.92)" },
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
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryArrow: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryFlag: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
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
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  sosBody: { flex: 1, minWidth: 0, gap: spacing.xs },
  sosTitle: { ...type.headlineLg, color: colors.onEmergency, letterSpacing: 0.5 },
  sosText: { ...type.bodyMd, color: "rgba(255,255,255,0.95)" },
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
  sosFooterText: { ...type.labelMd, color: "rgba(255,255,255,0.85)" },

  startOver: { alignItems: "center", paddingVertical: spacing.md },
  startOverText: { ...type.labelMd, color: colors.faint },
});
