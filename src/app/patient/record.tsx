import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ReferralCard } from "@/components/referral-card";
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  Screen,
  SectionTitle,
  Tone,
} from "@/components/ui";
import {
  api,
  ConsultationNote,
  PatientRecord,
  TriageEntry,
  TriageStatus,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { usePatientSession } from "@/lib/patient-session";
import { colors, radius, spacing } from "@/lib/theme";

const TRIAGE_STATUS_META: Record<TriageStatus, { label: string; tone: Tone }> = {
  WAITING: { label: "WAITING", tone: "warning" },
  IN_PROGRESS: { label: "WITH A DOCTOR", tone: "doctor" },
  DONE: { label: "REVIEWED", tone: "success" },
};

function TriageCard({ entry }: { entry: TriageEntry }) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = TRIAGE_STATUS_META[entry.status];

  return (
    <Card>
      <View style={styles.badgeRow}>
        <Badge label={statusMeta.label} tone={statusMeta.tone} />
        {entry.source === "voice_call" ? (
          <Badge label="📞 PHONE CALL" tone="neutral" />
        ) : null}
      </View>
      <Text style={styles.timestamp}>{formatDateTime(entry.created_at)}</Text>
      <Text style={styles.summary}>{entry.summary}</Text>

      {expanded ? (
        <View style={styles.answers}>
          {entry.answers.map((answer, position) => (
            <View key={`${entry.id}-${position}`} style={styles.answerRow}>
              <Text style={styles.answerQuestion}>{answer.question}</Text>
              <Text style={styles.answerValue}>{answer.answer}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable onPress={() => setExpanded(!expanded)} hitSlop={8}>
        <Text style={styles.toggle}>
          {expanded ? "Hide answers" : `Show all ${entry.answers.length} answers`}
        </Text>
      </Pressable>
    </Card>
  );
}

function NoteCard({ note }: { note: ConsultationNote }) {
  return (
    <Card style={note.is_high_risk ? styles.highRiskCard : undefined}>
      <View style={styles.badgeRow}>
        {note.is_high_risk ? <Badge label="HIGH RISK" tone="danger" /> : null}
        {note.referred_to_facility ? <Badge label="REFERRED" tone="warning" /> : null}
      </View>

      <Text style={styles.timestamp}>{formatDateTime(note.created_at)}</Text>
      <Text style={styles.noteText}>{note.note_text}</Text>

      {note.is_high_risk && note.high_risk_reason ? (
        <View style={styles.calloutDanger}>
          <Text style={styles.calloutLabel}>Reason for follow-up</Text>
          <Text style={styles.calloutBody}>{note.high_risk_reason}</Text>
        </View>
      ) : null}

      {note.referred_to_facility ? (
        <View style={styles.calloutWarning}>
          <Text style={styles.calloutLabel}>Referred to</Text>
          <Text style={styles.calloutBody}>
            {note.referred_to_facility.name} ({note.referred_to_facility.type})
          </Text>
          <Text style={styles.calloutMeta}>{note.referred_to_facility.area_label}</Text>
        </View>
      ) : null}

      <Text style={styles.author}>
        Dr. {note.doctor.name} - {note.doctor.specialization}
      </Text>
    </Card>
  );
}

export default function MyRecord() {
  const { session } = usePatientSession();
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading && !record) return <Loading label="Loading your record..." />;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {record ? (
        <Card>
          <Text style={styles.name}>{record.name}</Text>
          <Text style={styles.meta}>
            {record.age} years - {record.gender} - {record.village}
          </Text>
          <Text style={styles.meta}>
            {record.unique_code} - {record.phone} - speaks{" "}
            {record.preferred_language}
          </Text>
        </Card>
      ) : null}

      <SectionTitle>Symptom checks</SectionTitle>
      {record && record.triage_entries.length > 0 ? (
        record.triage_entries.map((entry) => (
          <TriageCard key={entry.id} entry={entry} />
        ))
      ) : (
        <EmptyState
          title="No symptom checks yet"
          body="Run a symptom check from your home screen."
        />
      )}

      <SectionTitle>Referrals</SectionTitle>
      {record && record.referrals.length > 0 ? (
        record.referrals.map((referral) => (
          <ReferralCard key={referral.id} referral={referral} audience="patient" />
        ))
      ) : (
        <EmptyState
          title="No referrals yet"
          body="If a doctor sends you to another facility, you can follow it here."
        />
      )}

      <SectionTitle>Doctor notes</SectionTitle>
      {record && record.notes.length > 0 ? (
        record.notes.map((note) => <NoteCard key={note.id} note={note} />)
      ) : (
        <EmptyState
          title="No doctor notes yet"
          body="Notes appear here after a doctor reviews your record."
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  meta: { fontSize: 14, color: colors.muted },

  timestamp: { fontSize: 12, fontWeight: "600", color: colors.faint },
  summary: { fontSize: 16, color: colors.text, lineHeight: 22, fontWeight: "500" },
  toggle: { fontSize: 14, fontWeight: "600", color: colors.patient, paddingTop: 2 },

  answers: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  answerRow: { gap: 2 },
  answerQuestion: { fontSize: 13, color: colors.faint, fontWeight: "600" },
  answerValue: { fontSize: 15, color: colors.text },

  highRiskCard: { borderColor: "#F3C9C9", borderWidth: 1.5 },
  badgeRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  noteText: { fontSize: 16, color: colors.text, lineHeight: 23 },
  author: { fontSize: 13, color: colors.muted, fontWeight: "600" },

  calloutDanger: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  calloutWarning: {
    backgroundColor: colors.warningTint,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  calloutLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: colors.muted,
  },
  calloutBody: { fontSize: 15, color: colors.text, lineHeight: 21 },
  calloutMeta: { fontSize: 13, color: colors.muted },
});
