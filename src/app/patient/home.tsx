import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge, Card, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, PatientRecord } from "@/lib/api";
import { usePatientSession } from "@/lib/patient-session";
import { colors, radius, shadow, spacing } from "@/lib/theme";

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
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

  if (loading && !record) {
    return <Loading label="Loading your record..." />;
  }

  const flagged = record?.notes.find((note) => note.is_high_risk) ?? null;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      {record ? <Text style={styles.greeting}>Namaste, {record.name}</Text> : null}

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

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
              ? `${record.triage_entries.length} symptom check${record.triage_entries.length === 1 ? "" : "s"} - ${record.notes.length} doctor note${record.notes.length === 1 ? "" : "s"}`
              : "Your triage history and doctor notes"
          }
          onPress={() => router.push("/patient/record")}
        />
        <Action
          icon="🏥"
          title="Nearby facilities"
          subtitle="Sub-centres, PHCs and hospitals around you"
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
