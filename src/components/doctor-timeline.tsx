import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { TRIAGE_STATUS_META } from "@/components/queue-card";
import { REFERRAL_STATUS_META } from "@/components/referral-card";
import { SoftBadge } from "@/components/ui";
import {
  ConsultationNote,
  MedicalDocument,
  PatientTimeline,
  Referral,
  TimelineEntry,
  TimelineKind,
  TriageEntry,
} from "@/lib/api";
import { ageLabel, formatIsoDate } from "@/lib/format";
import { TranslationKey, useT } from "@/lib/i18n";
import { colors, radius, spacing, touch, type } from "@/lib/theme";

const KIND_META: Record<TimelineKind, { icon: string; label: TranslationKey }> = {
  document: { icon: "description", label: "timeline.kind.document" },
  triage: { icon: "monitor_heart", label: "timeline.kind.triage" },
  note: { icon: "stethoscope", label: "timeline.kind.note" },
  referral: { icon: "local_hospital", label: "referral.category" },
};

const URGENCY_LABEL: Record<string, TranslationKey> = {
  EMERGENCY: "timeline.urgency.emergency",
  SEE_DOCTOR_SOON: "timeline.urgency.soon",
  HOME_CARE: "timeline.urgency.home",
};

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function DocumentDetail({ document }: { document: MedicalDocument }) {
  const { t } = useT();
  const summary = document.extracted_summary;

  if (document.status === "FAILED") {
    return (
      <DetailLine label={t("timeline.couldNotRead")} value={document.failure_reason ?? ""} />
    );
  }
  if (!summary) {
    return <DetailLine label={t("timeline.status")} value={t("timeline.stillAnalysing")} />;
  }

  const extractedHospital = summary.hospital_name;
  return (
    <>
      <Text style={styles.detailBody}>{summary.plain_summary}</Text>
      {summary.symptoms.length > 0 ? (
        <DetailLine label={t("timeline.symptoms")} value={summary.symptoms.join(", ")} />
      ) : null}
      {summary.medications.length > 0 ? (
        <DetailLine
          label={t("timeline.medicines")}
          value={summary.medications
            .map((m) => (m.details ? `${m.name} - ${m.details}` : m.name))
            .join("\n")}
        />
      ) : null}
      {summary.deficiencies.length > 0 ? (
        <DetailLine
          label={t("timeline.lowResults")}
          value={summary.deficiencies
            .map((f) => `${f.test}${f.value ? ` ${f.value}` : ""}`)
            .join("\n")}
        />
      ) : null}
      {summary.excesses.length > 0 ? (
        <DetailLine
          label={t("timeline.highResults")}
          value={summary.excesses
            .map((f) => `${f.test}${f.value ? ` ${f.value}` : ""}`)
            .join("\n")}
        />
      ) : null}
      <DetailLine
        label={t("timeline.visitDate")}
        value={
          document.visit_date
            ? `${formatIsoDate(document.visit_date)} (${
                document.visit_date_entered
                  ? t("timeline.enteredByPatient")
                  : t("timeline.readFromRecord")
              })`
            : t("timeline.notFoundInRecord")
        }
      />
      {document.hospital_name_entered &&
      extractedHospital &&
      extractedHospital.toLowerCase() !== (document.hospital_name ?? "").toLowerCase() ? (
        <DetailLine label={t("timeline.nameOnRecord")} value={extractedHospital} />
      ) : null}
      {summary.patient_age_mentioned ? (
        // Raw context only. The headline age comes from date of birth.
        <DetailLine
          label={t("timeline.ageInRecord")}
          value={t("timeline.ageInRecordValue", { age: summary.patient_age_mentioned })}
        />
      ) : null}
    </>
  );
}

function TriageDetail({ triage }: { triage: TriageEntry }) {
  const { t } = useT();
  const assessment = triage.assessment;
  return (
    <>
      <DetailLine
        label={t("timeline.status")}
        value={t("timeline.statusVia", {
          status: t(TRIAGE_STATUS_META[triage.status].label),
          source:
            triage.source === "voice_call"
              ? t("call.channel.phone")
              : t("queue.sourceApp"),
        })}
      />
      {assessment ? (
        // What the patient was told after submitting, so the doctor sees it too.
        <DetailLine
          label={t("timeline.resultShown")}
          value={[
            URGENCY_LABEL[assessment.urgency]
              ? t(URGENCY_LABEL[assessment.urgency])
              : assessment.urgency,
            assessment.red_flags.length > 0 ? assessment.red_flags.join(", ") : null,
            assessment.source === "rules" ? t("timeline.rulesOnly") : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      ) : null}
      {triage.answers.map((answer, index) => (
        <DetailLine key={index} label={answer.question.toUpperCase()} value={answer.answer} />
      ))}
    </>
  );
}

function NoteDetail({ note }: { note: ConsultationNote }) {
  const { t } = useT();
  return (
    <>
      <Text style={styles.detailBody}>{note.note_text}</Text>
      <DetailLine
        label={t("timeline.doctor")}
        value={t("timeline.doctorValue", {
          name: note.doctor.name,
          specialization: note.doctor.specialization,
        })}
      />
      {note.is_high_risk ? (
        <DetailLine
          label={t("common.highRisk")}
          value={note.high_risk_reason ?? t("timeline.flaggedForFollowUp")}
        />
      ) : null}
      {note.follow_up_due_date ? (
        <DetailLine
          label={t("timeline.followUp")}
          value={`${formatIsoDate(note.follow_up_due_date)} · ${
            note.follow_up_resolved ? t("timeline.followUpDone") : t("timeline.followUpOpen")
          }`}
        />
      ) : null}
    </>
  );
}

function ReferralDetail({ referral }: { referral: Referral }) {
  const { t } = useT();
  return (
    <>
      <DetailLine
        label={t("timeline.referredTo")}
        value={`${referral.to_facility.name} (${referral.to_facility.type})`}
      />
      <DetailLine
        label={t("timeline.status")}
        value={t(REFERRAL_STATUS_META[referral.status].label)}
      />
      {referral.notes ? <DetailLine label={t("timeline.note")} value={referral.notes} /> : null}
    </>
  );
}

function TimelineRow({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const meta = KIND_META[entry.kind];
  const external = entry.kind === "document";
  const accent = external ? colors.doctor : colors.patient;

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: accent }]}>
          <Icon name={meta.icon} size={16} color={colors.onPrimary} />
        </View>
        {isLast ? null : <View style={styles.line} />}
      </View>

      <View style={styles.entry}>
        <View style={styles.dateRow}>
          <Text style={styles.date}>
            {formatIsoDate(entry.date).toUpperCase()}
            {entry.date_is_estimated ? ` (${t("timeline.uploadDate")})` : ""}
          </Text>
          {entry.age_at_date_label ? (
            <View style={styles.agePill}>
              <Text style={styles.ageText}>
                {t("timeline.age", { age: ageLabel(entry.age_at_date_label) })}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.chips}>
          <SoftBadge label={entry.source} tone={external ? "doctor" : "patient"} />
          <Text style={styles.kind}>{t(meta.label)}</Text>
        </View>

        <Text style={styles.title}>{entry.title}</Text>

        {expanded ? (
          <View style={styles.details}>
            {entry.document ? <DocumentDetail document={entry.document} /> : null}
            {entry.triage ? <TriageDetail triage={entry.triage} /> : null}
            {entry.note ? <NoteDetail note={entry.note} /> : null}
            {entry.referral ? <ReferralDetail referral={entry.referral} /> : null}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded(!expanded)}
          style={styles.toggle}
          hitSlop={8}
        >
          <Icon name={expanded ? "expand_less" : "expand_more"} size={20} color={colors.doctor} />
          <Text style={styles.toggleText}>
            {expanded ? t("timeline.hideDetails") : t("timeline.showDetails")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The whole history in one scroll: outside hospital visits and MedLink's own
 * events, oldest first, each with the patient's age on that date.
 */
export function DoctorTimeline({ timeline }: { timeline: PatientTimeline }) {
  const { t } = useT();
  const { entries, patient } = timeline;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Icon name="timeline" size={24} color={colors.doctor} />
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle}>{t("timeline.title")}</Text>
          <Text style={styles.headerSub}>
            {t("timeline.entries", { count: entries.length })}
          </Text>
        </View>
      </View>

      {patient.date_of_birth === null ? (
        <View style={styles.noDob}>
          <Icon name="cake" size={20} color={colors.warning} />
          <Text style={styles.noDobText}>{t("timeline.noDob")}</Text>
        </View>
      ) : null}

      {entries.length === 0 ? (
        <Text style={styles.empty}>{t("timeline.empty")}</Text>
      ) : (
        entries.map((entry, index) => (
          <TimelineRow
            key={`${entry.kind}-${entry.document?.id ?? entry.triage?.id ?? entry.note?.id ?? entry.referral?.id}`}
            entry={entry}
            isLast={index === entries.length - 1}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.borderClinical,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerBody: { flex: 1 },
  headerTitle: { ...type.headlineMd, color: colors.text },
  headerSub: { ...type.labelMd, color: colors.muted },

  noDob: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.warningTint,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  noDobText: { ...type.bodyMd, color: colors.text, flex: 1 },
  empty: { ...type.bodyMd, color: colors.muted },

  row: { flexDirection: "row", gap: spacing.sm },
  rail: { alignItems: "center", width: 28 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },

  entry: { flex: 1, gap: spacing.xs, paddingBottom: spacing.md },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  date: { ...type.labelLg, color: colors.text, letterSpacing: 0.4 },
  agePill: {
    backgroundColor: colors.doctor,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  ageText: { ...type.labelMd, color: colors.onDoctor },
  chips: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  kind: { ...type.labelMd, color: colors.muted, letterSpacing: 0.6 },
  title: { ...type.bodyLg, color: colors.text },

  details: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  detailBody: { ...type.bodyLg, color: colors.text },
  detailLine: { gap: 2 },
  detailLabel: { ...type.labelMd, color: colors.faint, letterSpacing: 0.4 },
  detailValue: { ...type.bodyMd, color: colors.text },

  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    minHeight: touch.min,
  },
  toggleText: { ...type.labelLg, color: colors.doctor },
});
