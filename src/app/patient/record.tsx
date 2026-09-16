import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { ReferralCard } from "@/components/referral-card";
import {
  EmptyState,
  ErrorBanner,
  IconCircle,
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
import { formatDateTime, formatIsoDate } from "@/lib/format";
import { translate, TranslationKey, useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { useLocalizedSymptomTexts } from "@/lib/symptom-text";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";

const TRIAGE_STATUS_META: Record<TriageStatus, { label: TranslationKey; tone: Tone }> = {
  WAITING: { label: "status.waitingShort", tone: "warning" },
  IN_PROGRESS: { label: "record.withDoctor", tone: "doctor" },
  DONE: { label: "record.reviewed", tone: "success" },
};

/** The result the patient was shown after the check. */
const URGENCY_META: Record<string, { label: TranslationKey; tone: Tone }> = {
  EMERGENCY: { label: "symptom.result.emergencyTitle", tone: "emergency" },
  SEE_DOCTOR_SOON: { label: "symptom.result.soonTitle", tone: "warning" },
  HOME_CARE: { label: "symptom.result.homeTitle", tone: "success" },
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
      <Text style={styles.timeText}>{formatDateTime(at)}</Text>
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
        <IconCircle icon={icon} size={52} />
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
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const meta = TRIAGE_STATUS_META[entry.status];
  const urgency = entry.urgency ? URGENCY_META[entry.urgency] : undefined;

  // Saved in English; shown in the app's language.
  const [summary, ...answerTexts] = useLocalizedSymptomTexts([
    entry.summary,
    ...entry.answers.flatMap((answer) => [answer.question, answer.answer]),
  ]);

  return (
    <EntryCard icon="monitor_heart" category={t("timeline.kind.triage")} title={summary}>
      <View style={styles.chipRow}>
        <SoftBadge label={t(meta.label)} tone={meta.tone} />
        {entry.source === "voice_call" ? (
          <SoftBadge label={t("record.phoneCall")} tone="neutral" />
        ) : null}
        {urgency ? <SoftBadge label={t(urgency.label)} tone={urgency.tone} /> : null}
      </View>

      {expanded ? (
        <View style={styles.answers}>
          {entry.answers.map((_, position) => (
            <View key={`${entry.id}-${position}`} style={styles.answerRow}>
              <Text style={styles.answerQuestion}>{answerTexts[position * 2]}</Text>
              <Text style={styles.answerValue}>{answerTexts[position * 2 + 1]}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {entry.answers.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded(!expanded)}
          hitSlop={12}
          style={styles.toggleRow}
        >
          <Icon name={expanded ? "expand_less" : "expand_more"} size={24} color={colors.patient} />
          <Text style={styles.toggle}>
            {expanded
              ? t("record.hideAnswers")
              : t("record.showAnswers", { count: entry.answers.length })}
          </Text>
        </Pressable>
      ) : null}
    </EntryCard>
  );
}

function NoteBlock({ note }: { note: ConsultationNote }) {
  const { t } = useT();
  return (
    <EntryCard
      icon="stethoscope"
      category={t("timeline.kind.note")}
      title={note.is_high_risk ? t("record.followUpAdvised") : t("record.clinicalNote")}
    >
      <View style={styles.chipRow}>
        {note.is_high_risk ? <SoftBadge label={t("common.highRisk")} tone="warning" /> : null}
        {note.follow_up_due_date ? (
          <SoftBadge
            label={
              note.follow_up_resolved
                ? t("record.followUpDone")
                : t("record.due", {
                    date: formatIsoDate(note.follow_up_due_date),
                  })
            }
            tone={note.follow_up_resolved ? "success" : "warning"}
          />
        ) : null}
      </View>

      <View style={styles.quoteBox}>
        <View style={styles.quoteHead}>
          <Icon name="stethoscope" size={20} color={colors.patient} />
          <Text style={styles.quoteDoctor}>
            {t("common.doctorName", { name: note.doctor.name })}
          </Text>
          <Text style={styles.quoteRole}>· {note.doctor.specialization}</Text>
        </View>
        <Text style={styles.quoteText}>“{note.note_text}”</Text>
      </View>

      {note.is_high_risk && note.high_risk_reason ? (
        <View style={styles.callout}>
          <Text style={styles.calloutLabel}>{t("record.followUpReason")}</Text>
          <Text style={styles.calloutBody}>{note.high_risk_reason}</Text>
        </View>
      ) : null}

      {note.referred_to_facility ? (
        <View style={styles.callout}>
          <Text style={styles.calloutLabel}>{t("timeline.referredTo")}</Text>
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
  const { t } = useT();
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
      setError(caught instanceof Error ? caught.message : translate("home.loadFailed"));
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

  if (loading && !record) return <Loading label={t("home.loading")} />;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {timeline.length === 0 ? (
        <EmptyState
          icon="history_edu"
          title={t("record.emptyTitle")}
          body={t("record.emptyBody")}
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
  timelineItem: { gap: spacing.xs },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingLeft: spacing.xs,
  },
  timeText: { ...type.labelLg, color: colors.patient },

  entryCard: {
    ...elevation.level1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  entryTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  entryHeading: { flex: 1, minWidth: 0 },
  entryCategory: { ...type.labelMd, color: colors.muted },
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
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  calloutLabel: { ...type.labelMd, color: colors.muted },
  calloutBody: { ...type.bodyLg, color: colors.text },

  answers: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  answerRow: { gap: 2 },
  answerQuestion: { ...type.labelMd, color: colors.muted },
  answerValue: { ...type.bodyLg, color: colors.text },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 44 },
  toggle: { ...type.labelLg, color: colors.patient },
});
