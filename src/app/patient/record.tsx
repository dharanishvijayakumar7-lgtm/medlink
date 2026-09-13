import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { ReferralCard } from "@/components/referral-card";
import {
  EmptyState,
  ErrorBanner,
  Loading,
  Screen,
  SoftBadge,
  Tone,
} from "@/components/ui";
import {
  api,
  ConsultationNote,
  PatientRecord,
  Referral,
  TriageEntry,
  TriageStatus,
} from "@/lib/api";
import { ageShort, formatDateTime, formatIsoDate } from "@/lib/format";
import { usePatientSession } from "@/lib/patient-session";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";

const TRIAGE_STATUS_META: Record<TriageStatus, { label: string; tone: Tone }> = {
  WAITING: { label: "WAITING", tone: "warning" },
  IN_PROGRESS: { label: "WITH A DOCTOR", tone: "doctor" },
  DONE: { label: "REVIEWED", tone: "success" },
};

/** One chronological stream, as the Health Timeline mockup shows. */
type TimelineEntry =
  | { kind: "triage"; at: string; entry: TriageEntry }
  | { kind: "note"; at: string; note: ConsultationNote }
  | { kind: "referral"; at: string; referral: Referral };

function TimelineHeading({ at }: { at: string }) {
  return (
    <View style={styles.timeRow}>
      <Icon name="calendar_today" size={18} color={colors.patient} />
      <Text style={styles.timeText}>{formatDateTime(at).toUpperCase()}</Text>
    </View>
  );
}

function EntryCard({
  icon,
  category,
  title,
  children,
}: {
  icon: string;
  category: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.entryCard}>
      <View style={styles.entryTop}>
        <View style={styles.entryIcon}>
          <Icon name={icon} size={28} color={colors.onPrimaryFixed} />
        </View>
        <View style={styles.entryHeading}>
          <Text style={styles.entryCategory}>{category}</Text>
          <Text style={styles.entryTitle}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function TriageBlock({ entry }: { entry: TriageEntry }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TRIAGE_STATUS_META[entry.status];

  return (
    <EntryCard icon="monitor_heart" category="SYMPTOM CHECK" title={entry.summary}>
      <View style={styles.chipRow}>
        <SoftBadge label={meta.label} tone={meta.tone} />
        {entry.source === "voice_call" ? (
          <SoftBadge label="PHONE CALL" tone="neutral" />
        ) : null}
      </View>

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

      {entry.answers.length > 0 ? (
        <Pressable onPress={() => setExpanded(!expanded)} hitSlop={12}>
          <Text style={styles.toggle}>
            {expanded ? "Hide answers" : `Show all ${entry.answers.length} answers`}
          </Text>
        </Pressable>
      ) : null}
    </EntryCard>
  );
}

function NoteBlock({ note }: { note: ConsultationNote }) {
  return (
    <EntryCard
      icon="stethoscope"
      category="DOCTOR NOTE"
      title={note.is_high_risk ? "Follow-up advised" : "Clinical note"}
    >
      <View style={styles.chipRow}>
        {note.is_high_risk ? <SoftBadge label="HIGH RISK" tone="warning" /> : null}
        {note.follow_up_due_date ? (
          <SoftBadge
            label={
              note.follow_up_resolved
                ? "FOLLOW-UP DONE"
                : `DUE ${formatIsoDate(note.follow_up_due_date).toUpperCase()}`
            }
            tone={note.follow_up_resolved ? "success" : "warning"}
          />
        ) : null}
      </View>

      <View style={styles.quoteBox}>
        <View style={styles.quoteHead}>
          <Icon name="stethoscope" size={20} color={colors.patient} />
          <Text style={styles.quoteDoctor}>Dr. {note.doctor.name}</Text>
          <Text style={styles.quoteRole}>· {note.doctor.specialization}</Text>
        </View>
        <Text style={styles.quoteText}>“{note.note_text}”</Text>
      </View>

      {note.is_high_risk && note.high_risk_reason ? (
        <View style={styles.callout}>
          <Text style={styles.calloutLabel}>REASON FOR FOLLOW-UP</Text>
          <Text style={styles.calloutBody}>{note.high_risk_reason}</Text>
        </View>
      ) : null}

      {note.referred_to_facility ? (
        <View style={styles.callout}>
          <Text style={styles.calloutLabel}>REFERRED TO</Text>
          <Text style={styles.calloutBody}>
            {note.referred_to_facility.name} ({note.referred_to_facility.type})
          </Text>
        </View>
      ) : null}
    </EntryCard>
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

  const timeline = useMemo<TimelineEntry[]>(() => {
    if (!record) return [];
    const entries: TimelineEntry[] = [
      ...record.triage_entries.map(
        (entry): TimelineEntry => ({ kind: "triage", at: entry.created_at, entry }),
      ),
      ...record.notes.map(
        (note): TimelineEntry => ({ kind: "note", at: note.created_at, note }),
      ),
      ...record.referrals.map(
        (referral): TimelineEntry => ({
          kind: "referral",
          at: referral.created_at,
          referral,
        }),
      ),
    ];
    return entries.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [record]);

  if (loading && !record) return <Loading label="Loading your record..." />;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Icon name="history_edu" size={24} color={colors.onPatient} />
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle}>Health Timeline</Text>
          <Text style={styles.headerSubtitle}>
            {timeline.length} clinical{" "}
            {timeline.length === 1 ? "entry" : "entries"}
          </Text>
        </View>
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {record ? (
        <View style={styles.patientCard}>
          <Text style={styles.patientName}>{record.name}</Text>
          <Text style={styles.patientMeta}>
            {record.unique_code} · {ageShort(record.age_label)} · {record.gender}
          </Text>
          <Text style={styles.patientMeta}>
            {record.village} · {record.phone} · speaks {record.preferred_language}
          </Text>
        </View>
      ) : null}

      {timeline.length === 0 ? (
        <EmptyState
          icon="history_edu"
          title="Nothing on your timeline yet"
          body="Run a symptom check from your home screen to start your record."
        />
      ) : (
        timeline.map((item) => {
          if (item.kind === "triage") {
            return (
              <View key={`t-${item.entry.id}`} style={styles.timelineItem}>
                <TimelineHeading at={item.at} />
                <TriageBlock entry={item.entry} />
              </View>
            );
          }
          if (item.kind === "note") {
            return (
              <View key={`n-${item.note.id}`} style={styles.timelineItem}>
                <TimelineHeading at={item.at} />
                <NoteBlock note={item.note} />
              </View>
            );
          }
          return (
            <View key={`r-${item.referral.id}`} style={styles.timelineItem}>
              <TimelineHeading at={item.at} />
              <ReferralCard referral={item.referral} audience="patient" />
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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

  patientCard: {
    ...elevation.level1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 2,
  },
  patientName: { ...type.headlineMd, color: colors.text },
  patientMeta: { ...type.bodyMd, color: colors.muted },

  timelineItem: { gap: spacing.xs },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingLeft: spacing.xs,
  },
  timeText: { ...type.labelLg, color: colors.patient, letterSpacing: 0.6 },

  entryCard: {
    ...elevation.level1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  entryTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  entryIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.tile,
    backgroundColor: colors.patientTint,
    alignItems: "center",
    justifyContent: "center",
  },
  entryHeading: { flex: 1, minWidth: 0 },
  entryCategory: { ...type.labelMd, color: colors.muted, letterSpacing: 0.8 },
  entryTitle: { ...type.headlineMd, color: colors.text },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },

  quoteBox: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  quoteHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  quoteDoctor: { ...type.labelLg, color: colors.text },
  quoteRole: { ...type.bodyMd, color: colors.muted, flexShrink: 1 },
  quoteText: {
    ...type.bodyXl,
    color: colors.text,
    fontStyle: "italic",
    paddingLeft: spacing.sm,
  },

  callout: {
    backgroundColor: colors.warningTint,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  calloutLabel: { ...type.labelMd, color: colors.muted, letterSpacing: 0.6 },
  calloutBody: { ...type.bodyLg, color: colors.text },

  answers: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  answerRow: { gap: 2 },
  answerQuestion: { ...type.labelMd, color: colors.faint },
  answerValue: { ...type.bodyLg, color: colors.text },
  toggle: { ...type.labelLg, color: colors.patient },
});
