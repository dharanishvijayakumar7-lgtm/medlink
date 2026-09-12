import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge, Card, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, Consultation, PatientRecord } from "@/lib/api";
import { usePatientSession } from "@/lib/patient-session";
import { colors, radius, shadow, spacing } from "@/lib/theme";

/** How often to check for a doctor starting a call. Push comes in a later part. */
const POLL_MS = 10_000;

type ActionProps = {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
};

function Action({ icon, title, subtitle, onPress, danger }: ActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        danger && styles.actionDanger,
        pressed && styles.actionPressed,
      ]}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, danger && { color: colors.danger }]}>
          {title}
        </Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>{"›"}</Text>
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
      {record ? <Text style={styles.greeting}>Namaste, {record.name}</Text> : null}

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {pending ? (
        <Pressable
          accessibilityRole="button"
          onPress={joinCall}
          style={({ pressed }) => [styles.callBanner, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.callIcon}>📹</Text>
          <View style={styles.callText}>
            <Text style={styles.callTitle}>Dr. {pending.doctor_name} is ready</Text>
            <Text style={styles.callSubtitle}>
              Tap to join your consultation now
            </Text>
          </View>
          <View style={styles.callAction}>
            <Text style={styles.callActionText}>Join</Text>
          </View>
        </Pressable>
      ) : null}

      <Card style={styles.idCard}>
        <Text style={styles.idLabel}>Your MedLink ID</Text>
        <Text style={styles.idValue} selectable>
          {code}
        </Text>
        <Text style={styles.idHelp}>
          Share this ID with any doctor or health worker to let them open your record.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={copyCode}
          style={({ pressed }) => [styles.copyButton, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.copyText}>
            {copied ? "✓  Copied" : "Copy ID"}
          </Text>
        </Pressable>
      </Card>

      {position !== null ? (
        <Card style={styles.queueCard}>
          <Text style={styles.queueLabel}>Your place in the queue</Text>
          <View style={styles.queueRow}>
            <Text style={styles.queueNumber}>#{position}</Text>
            <Text style={styles.queueHint}>
              {position === 1
                ? "You are next. Keep your phone nearby."
                : `${position - 1} ${position === 2 ? "person is" : "people are"} ahead of you.`}
            </Text>
          </View>
        </Card>
      ) : null}

      {flagged ? (
        <Card style={styles.flagCard}>
          <Badge label="FLAGGED BY A DOCTOR" tone="danger" />
          <Text style={styles.flagText}>
            {flagged.high_risk_reason?.trim()
              ? flagged.high_risk_reason
              : "A doctor marked you as needing follow-up."}
          </Text>
          <Text style={styles.flagMeta}>
            Dr. {flagged.doctor.name} - open My record for the full note.
          </Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Action
          icon="🩺"
          title="Start symptom check"
          subtitle="Answer a few questions about how you feel"
          onPress={() => router.push("/patient/symptom-check")}
        />
        <Action
          icon="📋"
          title="My record"
          subtitle={
            record
              ? `${record.triage_entries.length} symptom check${record.triage_entries.length === 1 ? "" : "s"} - ${record.referrals.length} referral${record.referrals.length === 1 ? "" : "s"}`
              : "Your triage history, referrals and doctor notes"
          }
          onPress={() => router.push("/patient/record")}
        />
        <Action
          icon="🏥"
          title="Nearby facilities"
          subtitle="See what medicines and tests are in stock"
          onPress={() => router.push("/patient/facilities")}
        />
        <Action
          icon="🚨"
          title="Emergency SOS"
          subtitle="Call 112 and read out your location"
          onPress={() => router.push("/patient/sos")}
          danger
        />
      </View>

      <Pressable onPress={startOver} style={styles.startOver} hitSlop={8}>
        <Text style={styles.startOverText}>Not you? Register a different patient</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 22, fontWeight: "700", color: colors.text },

  callBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.success,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  callIcon: { fontSize: 26 },
  callText: { flex: 1, gap: 2 },
  callTitle: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  callSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.9)" },
  callAction: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  callActionText: { color: colors.success, fontWeight: "800", fontSize: 15 },

  idCard: {
    backgroundColor: colors.patient,
    borderColor: colors.patientDark,
    gap: spacing.xs,
  },
  idLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.75)",
  },
  idValue: {
    fontSize: 38,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1.5,
  },
  idHelp: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  copyButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  copyText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },

  queueCard: { gap: spacing.sm },
  queueLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.faint,
  },
  queueRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  queueNumber: { fontSize: 40, fontWeight: "800", color: colors.patient },
  queueHint: { flex: 1, fontSize: 15, color: colors.muted, lineHeight: 21 },

  flagCard: { backgroundColor: colors.dangerTint, borderColor: "#F3C9C9" },
  flagText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  flagMeta: { fontSize: 13, color: colors.muted },

  actions: { gap: spacing.md, marginTop: spacing.sm },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow,
  },
  actionDanger: { borderColor: "#F3C9C9", backgroundColor: colors.dangerTint },
  actionPressed: { opacity: 0.85 },
  actionIcon: { fontSize: 26 },
  actionText: { flex: 1, gap: 2 },
  actionTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  actionSubtitle: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  chevron: { fontSize: 26, color: colors.faint },

  startOver: { alignItems: "center", paddingVertical: spacing.lg },
  startOverText: { fontSize: 14, color: colors.faint, fontWeight: "600" },
});
