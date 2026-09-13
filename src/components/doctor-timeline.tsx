import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
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
import { formatIsoDate } from "@/lib/format";
import { colors, radius, spacing, touch, type } from "@/lib/theme";

const KIND_META: Record<TimelineKind, { icon: string; label: string }> = {
  document: { icon: "description", label: "UPLOADED RECORD" },
  triage: { icon: "monitor_heart", label: "SYMPTOM CHECK" },
  note: { icon: "stethoscope", label: "DOCTOR NOTE" },
  referral: { icon: "local_hospital", label: "REFERRAL" },
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
  const summary = document.extracted_summary;

  if (document.status === "FAILED") {
    return <DetailLine label="COULD NOT BE READ" value={document.failure_reason ?? ""} />;
  }
  if (!summary) {
    return <DetailLine label="STATUS" value="Still being analysed on the server." />;
  }

  const extractedHospital = summary.hospital_name;
  return (
    <>
      <Text style={styles.detailBody}>{summary.plain_summary}</Text>
      {summary.symptoms.length > 0 ? (
        <DetailLine label="SYMPTOMS" value={summary.symptoms.join(", ")} />
      ) : null}
      {summary.medications.length > 0 ? (
        <DetailLine
          label="MEDICINES"
          value={summary.medications
            .map((m) => (m.details ? `${m.name} - ${m.details}` : m.name))
            .join("\n")}
        />
      ) : null}
      {summary.deficiencies.length > 0 ? (
        <DetailLine
          label="LOW RESULTS"
          value={summary.deficiencies
            .map((f) => `${f.test}${f.value ? ` ${f.value}` : ""}`)
            .join("\n")}
        />
      ) : null}
      {summary.excesses.length > 0 ? (
        <DetailLine
          label="HIGH RESULTS"
          value={summary.excesses
            .map((f) => `${f.test}${f.value ? ` ${f.value}` : ""}`)
            .join("\n")}
        />
      ) : null}
      <DetailLine
        label="VISIT DATE"
        value={
          document.visit_date
            ? `${formatIsoDate(document.visit_date)} (${
                document.visit_date_entered ? "entered by patient" : "read from the record"
              })`
            : "Not found in the record"
        }
      />
      {document.hospital_name_entered &&
      extractedHospital &&
      extractedHospital.toLowerCase() !== (document.hospital_name ?? "").toLowerCase() ? (
        <DetailLine label="NAME ON THE RECORD" value={extractedHospital} />
      ) : null}
      {summary.patient_age_mentioned ? (
        // Raw context only. The headline age comes from date of birth.
        <DetailLine
          label="AGE WRITTEN IN THE RECORD"
          value={`${summary.patient_age_mentioned} - as written; the age shown above is calculated from date of birth`}
        />
      ) : null}
    </>
  );
}

function TriageDetail({ triage }: { triage: TriageEntry }) {
  return (
    <>
      <DetailLine
        label="STATUS"
        value={`${triage.status.replace("_", " ").toLowerCase()} · via ${
          triage.source === "voice_call" ? "phone call" : "app"
        }`}
      />
      {triage.answers.map((answer, index) => (
        <DetailLine key={index} label={answer.question.toUpperCase()} value={answer.answer} />
      ))}
    </>
  );
}

function NoteDetail({ note }: { note: ConsultationNote }) {
  return (
    <>
      <Text style={styles.detailBody}>{note.note_text}</Text>
      <DetailLine label="DOCTOR" value={`Dr. ${note.doctor.name} · ${note.doctor.specialization}`} />
      {note.is_high_risk ? (
        <DetailLine label="HIGH RISK" value={note.high_risk_reason ?? "Flagged for follow-up"} />
      ) : null}
      {note.follow_up_due_date ? (
        <DetailLine
          label="FOLLOW-UP"
          value={`${formatIsoDate(note.follow_up_due_date)} · ${
            note.follow_up_resolved ? "done" : "open"
          }`}
        />
      ) : null}
    </>
  );
}

function ReferralDetail({ referral }: { referral: Referral }) {
  return (
    <>
      <DetailLine
        label="REFERRED TO"
        value={`${referral.to_facility.name} (${referral.to_facility.type})`}
      />
      <DetailLine label="STATUS" value={referral.status.replace("_", " ").toLowerCase()} />
      {referral.notes ? <DetailLine label="NOTE" value={referral.notes} /> : null}
    </>
  );
}

function TimelineRow({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
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
            {entry.date_is_estimated ? " (upload date)" : ""}
          </Text>
          {entry.age_at_date_label ? (
            <View style={styles.agePill}>
              <Text style={styles.ageText}>Age {entry.age_at_date_label}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.chips}>
          <SoftBadge label={entry.source} tone={external ? "doctor" : "patient"} />
          <Text style={styles.kind}>{meta.label}</Text>
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
          <Text style={styles.toggleText}>{expanded ? "Hide details" : "Show details"}</Text>
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
  const { entries, patient } = timeline;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Icon name="timeline" size={24} color={colors.doctor} />
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle}>Timeline</Text>
          <Text style={styles.headerSub}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"} · oldest first
          </Text>
        </View>
      </View>

      {patient.date_of_birth === null ? (
        <View style={styles.noDob}>
          <Icon name="cake" size={20} color={colors.warning} />
          <Text style={styles.noDobText}>
            Ages at each visit are not shown - this patient has not given a date of
            birth yet.
          </Text>
        </View>
      ) : null}

      {entries.length === 0 ? (
        <Text style={styles.empty}>No history yet.</Text>
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
