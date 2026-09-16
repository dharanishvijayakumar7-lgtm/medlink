import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DoctorTimeline } from "@/components/doctor-timeline";
import { DueDateField } from "@/components/due-date-field";
import { FacilityPicker } from "@/components/facility-picker";
import { Icon } from "@/components/icon";
import { TRIAGE_STATUS_META } from "@/components/queue-card";
import { REFERRAL_STATUS_META, ReferralCard } from "@/components/referral-card";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorBanner,
  Loading,
  Screen,
  SectionTitle,
  SoftBadge,
  TextField,
} from "@/components/ui";
import {
  api,
  ConsultationNote,
  Facility,
  PatientRecord,
  PatientTimeline,
  Referral,
  ReferralStatus,
  TriageEntry,
} from "@/lib/api";
import {
  ageLong,
  daysUntilIsoDate,
  describeDueDate,
  formatDateTime,
  formatIsoDate,
  isValidIsoDate,
  languageLabel,
} from "@/lib/format";
import { useDoctorSession } from "@/lib/doctor-session";
import { translate, TranslationKey, useT } from "@/lib/i18n";
import { isWebRtcAvailable } from "@/lib/livekit";
import { colors, radius, spacing, touch, type } from "@/lib/theme";

/** Statuses a doctor can move a referral to, beyond the one it already has. */
const NEXT_STATUSES: ReferralStatus[] = ["CONFIRMED", "COMPLETED", "NO_SHOW"];

/** What the patient was told after an in-app symptom check. */
const URGENCY_LABEL: Record<string, { label: TranslationKey; tone: "emergency" | "warning" | "success" }> = {
  EMERGENCY: { label: "timeline.urgency.emergency", tone: "emergency" },
  SEE_DOCTOR_SOON: { label: "timeline.urgency.soon", tone: "warning" },
  HOME_CARE: { label: "timeline.urgency.home", tone: "success" },
};

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function TriageCard({ entry }: { entry: TriageEntry }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const statusMeta = TRIAGE_STATUS_META[entry.status];
  const fromPhone = entry.source === "voice_call";
  const urgency = entry.urgency ? URGENCY_LABEL[entry.urgency] : undefined;

  return (
    <Card>
      <View style={styles.badgeRow}>
        <SoftBadge label={t(statusMeta.short)} tone={statusMeta.tone} />
        <SoftBadge
          label={fromPhone ? t("record.phoneCall") : t("patientDetail.app")}
          tone="neutral"
        />
        <Text style={styles.timestamp}>{formatDateTime(entry.created_at)}</Text>
      </View>
      {urgency ? <SoftBadge label={t(urgency.label)} tone={urgency.tone} /> : null}
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

      {entry.answers.length > 0 ? (
        <Pressable onPress={() => setExpanded(!expanded)} hitSlop={12}>
          <Text style={styles.toggle}>
            {expanded
              ? t("record.hideAnswers")
              : t("record.showAnswers", { count: entry.answers.length })}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function NoteCard({
  note,
  onResolve,
  onReopen,
  busy,
}: {
  note: ConsultationNote;
  onResolve: (noteId: number) => void;
  onReopen: (noteId: number) => void;
  busy: boolean;
}) {
  const { t } = useT();
  const due = note.follow_up_due_date;
  const overdue = due !== null && !note.follow_up_resolved && daysUntilIsoDate(due) < 0;

  return (
    <Card clinical={note.is_high_risk}>
      <View style={styles.badgeRow}>
        {note.is_high_risk ? (
          <Badge label={t("common.highRisk")} tone="warning" icon="warning" />
        ) : null}
        {note.referred_to_facility ? (
          <SoftBadge label={t("patientDetail.referred")} tone="warning" />
        ) : null}
        {due !== null ? (
          <SoftBadge
            label={
              note.follow_up_resolved
                ? t("record.followUpDone")
                : t("patientDetail.followUpOpen")
            }
            tone={note.follow_up_resolved ? "success" : "warning"}
          />
        ) : null}
      </View>

      <Text style={styles.timestamp}>{formatDateTime(note.created_at)}</Text>
      <Text style={styles.noteText}>{note.note_text}</Text>

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

      {due !== null ? (
        <View
          style={[
            styles.callout,
            note.follow_up_resolved
              ? styles.calloutSuccess
              : overdue
                ? styles.calloutWarning
                : undefined,
          ]}
        >
          <Text style={styles.calloutLabel}>{t("timeline.followUp")}</Text>
          <Text style={styles.calloutBody}>
            {formatIsoDate(due)} · {describeDueDate(due)}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() =>
              note.follow_up_resolved ? onReopen(note.id) : onResolve(note.id)
            }
            style={({ pressed }) => [
              styles.followUpButton,
              note.follow_up_resolved && styles.followUpButtonMuted,
              (pressed || busy) && { opacity: 0.6 },
            ]}
          >
            <Icon
              name={note.follow_up_resolved ? "restart_alt" : "check"}
              size={18}
              color={note.follow_up_resolved ? colors.muted : colors.success}
            />
            <Text
              style={[
                styles.followUpButtonText,
                note.follow_up_resolved && { color: colors.muted },
              ]}
            >
              {note.follow_up_resolved
                ? t("patientDetail.reopenFollowUp")
                : t("patientDetail.markFollowUpDone")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.author}>
        {t("timeline.doctorValue", {
          name: note.doctor.name,
          specialization: note.doctor.specialization,
        })}
      </Text>
    </Card>
  );
}

export default function DoctorPatientDetail() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { doctor } = useDoctorSession();
  const { t } = useT();

  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [timeline, setTimeline] = useState<PatientTimeline | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [noteText, setNoteText] = useState("");
  const [highRisk, setHighRisk] = useState(false);
  const [riskReason, setRiskReason] = useState("");
  // Raw draft string so the whole note form clears in one place.
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  const [referralFacilityId, setReferralFacilityId] = useState<number | null>(null);
  const [referralNotes, setReferralNotes] = useState("");
  const [savingReferral, setSavingReferral] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [busyReferral, setBusyReferral] = useState<number | null>(null);

  const [startingCall, setStartingCall] = useState(false);
  const [busyFollowUp, setBusyFollowUp] = useState<number | null>(null);

  useEffect(() => {
    if (!doctor) router.replace("/doctor");
  }, [doctor, router]);

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      // The record drives the forms; the timeline merges in uploaded records.
      // Fetched together so a new note shows up in both after one refresh.
      const [nextRecord, nextTimeline] = await Promise.all([
        api.getPatientRecord(code),
        api.getTimeline(code),
      ]);
      setRecord(nextRecord);
      setTimeline(nextTimeline);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : translate("patientDetail.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [code]);

  const loadFacilities = useCallback(async () => {
    try {
      setFacilities(await api.getFacilities());
    } catch {
      setFacilities([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadFacilities();
    }, [load, loadFacilities]),
  );

  async function startCall() {
    if (!doctor || !record) return;
    if (!isWebRtcAvailable) {
      // Opening a room the doctor cannot join would leave the patient staring
      // at a Join prompt for a call nobody is in.
      setError(t("patientDetail.callNeedsBuild"));
      return;
    }
    setStartingCall(true);
    setError(null);
    try {
      const consultation = await api.startConsultation(record.unique_code, doctor.id);
      router.push({
        pathname: "/call",
        params: {
          token: consultation.token,
          serverUrl: consultation.livekit_url,
          roomName: consultation.room_name,
          peerName: record.name,
          consultationId: String(consultation.id),
          role: "doctor",
        },
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("patientDetail.callFailed"),
      );
    } finally {
      setStartingCall(false);
    }
  }

  async function saveNote() {
    if (!doctor || !record) return;
    if (!noteText.trim()) {
      setNoteError(t("patientDetail.noteEmpty"));
      return;
    }

    const due = followUpDraft.trim();
    if (highRisk && due && !isValidIsoDate(due)) {
      setNoteError(t("patientDetail.noteDateFormat"));
      return;
    }

    setNoteError(null);
    setSavingNote(true);
    try {
      await api.addConsultationNote(record.unique_code, {
        doctor_id: doctor.id,
        note_text: noteText.trim(),
        is_high_risk: highRisk,
        high_risk_reason: highRisk ? riskReason.trim() || null : null,
        follow_up_due_date: highRisk && due ? due : null,
      });
      setNoteText("");
      setHighRisk(false);
      setRiskReason("");
      setFollowUpDraft("");
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2500);
      await load();
    } catch (caught) {
      setNoteError(
        caught instanceof Error ? caught.message : t("patientDetail.noteFailed"),
      );
    } finally {
      setSavingNote(false);
    }
  }

  async function createReferral() {
    if (!doctor || !record) return;
    if (referralFacilityId === null) {
      setReferralError(t("patientDetail.referralNoFacility"));
      return;
    }

    setReferralError(null);
    setSavingReferral(true);
    try {
      await api.createReferral({
        patient_unique_code: record.unique_code,
        doctor_id: doctor.id,
        to_facility_id: referralFacilityId,
        notes: referralNotes.trim() || null,
      });
      setReferralFacilityId(null);
      setReferralNotes("");
      await load();
    } catch (caught) {
      setReferralError(
        caught instanceof Error ? caught.message : t("patientDetail.referralFailed"),
      );
    } finally {
      setSavingReferral(false);
    }
  }

  async function resolveFollowUp(noteId: number) {
    setBusyFollowUp(noteId);
    try {
      await api.updateFollowUp(noteId, { follow_up_resolved: true });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("patientDetail.closeFailed"),
      );
    } finally {
      setBusyFollowUp(null);
    }
  }

  async function reopenFollowUp(noteId: number) {
    setBusyFollowUp(noteId);
    try {
      await api.updateFollowUp(noteId, { follow_up_resolved: false });
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("patientDetail.reopenFailed"),
      );
    } finally {
      setBusyFollowUp(null);
    }
  }

  async function setReferralStatus(referral: Referral, status: ReferralStatus) {
    setBusyReferral(referral.id);
    try {
      await api.updateReferralStatus(referral.id, status);
      await load();
    } catch (caught) {
      setReferralError(
        caught instanceof Error ? caught.message : t("patientDetail.referralUpdateFailed"),
      );
    } finally {
      setBusyReferral(null);
    }
  }

  if (!doctor) return <Loading />;
  if (loading && !record) return <Loading label={t("patientDetail.loading")} />;

  if (error && !record) {
    return (
      <Screen>
        <ErrorBanner message={error} onRetry={load} />
        <Button
          title={t("common.back")}
          onPress={() => router.back()}
          tone="doctor"
          variant="outline"
        />
      </Screen>
    );
  }

  const flagged = record?.notes.some((note) => note.is_high_risk) ?? false;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <Stack.Screen options={{ title: record?.unique_code ?? t("nav.doctor.patient") }} />

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {record ? (
        <View style={styles.profile}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Icon name="person" size={30} color={colors.doctor} />
            </View>
            <View style={styles.profileHeading}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {record.name}
                </Text>
                <View style={styles.agePill}>
                  <Text style={styles.agePillText}>
                    {record.age !== null ? record.age : ""}
                    {record.gender.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.born}>
                {record.date_of_birth
                  ? t("patientDetail.born", { date: formatIsoDate(record.date_of_birth) })
                  : t("patientDetail.noDob")}
              </Text>
              <View style={styles.idChip}>
                <Text style={styles.idChipText}>{record.unique_code}</Text>
              </View>
            </View>
          </View>

          <View style={styles.badgeRow}>
            {flagged ? (
              <Badge label={t("common.highRisk")} tone="warning" icon="warning" />
            ) : null}
            {record.queue_position !== null ? (
              <SoftBadge
                label={t("patientDetail.inQueue", { position: record.queue_position })}
                tone="doctor"
              />
            ) : null}
          </View>

          <View style={styles.metaGrid}>
            {/* Computed by the server from date of birth, at request time. */}
            <MetaCell label={t("patientDetail.age")} value={ageLong(record.age_label)} />
            <MetaCell label={t("patientDetail.village")} value={record.village} />
            <MetaCell label={t("patientDetail.phone")} value={record.phone} />
            <MetaCell
              label={t("patientDetail.language")}
              value={languageLabel(record.preferred_language)}
            />
          </View>
        </View>
      ) : null}

      <Button
        title={t("patientDetail.startCall")}
        icon="videocam"
        onPress={startCall}
        loading={startingCall}
        tone="success"
      />
      <Text style={styles.callHint}>
        {isWebRtcAvailable ? t("patientDetail.callHint") : t("patientDetail.callUnavailable")}
      </Text>

      {/* History first, so the doctor reads it before writing anything. */}
      {timeline ? <DoctorTimeline timeline={timeline} /> : null}

      <SectionTitle>{t("patientDetail.addNote")}</SectionTitle>
      <Card style={styles.formCard}>
        {noteError ? <ErrorBanner message={noteError} /> : null}
        {savedNote ? (
          <View style={styles.savedNotice}>
            <Icon name="check_circle" size={20} color={colors.success} />
            <Text style={styles.savedNoticeText}>{t("patientDetail.noteSaved")}</Text>
          </View>
        ) : null}

        <TextField
          label={t("patientDetail.note")}
          labelIcon="clinical_notes"
          value={noteText}
          onChangeText={setNoteText}
          placeholder={t("patientDetail.notePlaceholder")}
          multiline
        />

        <Checkbox
          label={t("patientDetail.flag")}
          value={highRisk}
          onValueChange={setHighRisk}
          tone="warning"
        />

        {highRisk ? (
          <>
            <TextField
              label={t("patientDetail.reason")}
              value={riskReason}
              onChangeText={setRiskReason}
              placeholder={t("patientDetail.reasonPlaceholder")}
              multiline
            />
            <DueDateField value={followUpDraft} onChange={setFollowUpDraft} />
          </>
        ) : null}

        <Button
          title={t("patientDetail.saveNote")}
          icon="save"
          onPress={saveNote}
          loading={savingNote}
          tone="doctor"
        />
      </Card>

      <SectionTitle>{t("patientDetail.referTitle")}</SectionTitle>
      <Card style={styles.formCard}>
        {referralError ? <ErrorBanner message={referralError} /> : null}
        <FacilityPicker
          label={t("patientDetail.referTo")}
          facilities={facilities}
          selectedId={referralFacilityId}
          onSelect={setReferralFacilityId}
          emptyLabel={t("stock.chooseFacility")}
          hint={t("patientDetail.referHint")}
        />
        <TextField
          label={t("patientDetail.referNote")}
          value={referralNotes}
          onChangeText={setReferralNotes}
          placeholder={t("patientDetail.referNotePlaceholder")}
          multiline
        />
        <Button
          title={t("patientDetail.createReferral")}
          icon="send"
          onPress={createReferral}
          loading={savingReferral}
          tone="doctor"
        />
      </Card>

      {record && record.referrals.length > 0 ? (
        <>
          <SectionTitle>{t("patientDetail.referrals")}</SectionTitle>
          {record.referrals.map((referral) => (
            <ReferralCard key={referral.id} referral={referral} audience="doctor">
              <View style={styles.statusActions}>
                {NEXT_STATUSES.filter((status) => status !== referral.status).map(
                  (status) => (
                    <Pressable
                      key={status}
                      accessibilityRole="button"
                      disabled={busyReferral === referral.id}
                      onPress={() => setReferralStatus(referral, status)}
                      style={({ pressed }) => [
                        styles.statusButton,
                        pressed && { opacity: 0.8 },
                        busyReferral === referral.id && { opacity: 0.5 },
                      ]}
                    >
                      <Text style={styles.statusButtonText}>
                        {t(REFERRAL_STATUS_META[status].label)}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            </ReferralCard>
          ))}
        </>
      ) : null}

      <SectionTitle>{t("patientDetail.triageHistory")}</SectionTitle>
      {record && record.triage_entries.length > 0 ? (
        record.triage_entries.map((entry) => (
          <TriageCard key={entry.id} entry={entry} />
        ))
      ) : (
        <EmptyState icon="monitor_heart" title={t("patientDetail.noTriage")} />
      )}

      <SectionTitle>{t("patientDetail.pastNotes")}</SectionTitle>
      {record && record.notes.length > 0 ? (
        record.notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onResolve={resolveFollowUp}
            onReopen={reopenFollowUp}
            busy={busyFollowUp === note.id}
          />
        ))
      ) : (
        <EmptyState icon="clinical_notes" title={t("patientDetail.noNotes")} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  profileTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.doctorTint,
    alignItems: "center",
    justifyContent: "center",
  },
  profileHeading: { flex: 1, minWidth: 0, gap: spacing.xs },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  name: { ...type.headlineMd, color: colors.text, flexShrink: 1 },
  agePill: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  agePillText: { ...type.labelMd, color: colors.onSecondaryContainer },
  idChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  idChipText: { ...type.labelMd, color: colors.doctor, letterSpacing: 1 },

  born: { ...type.labelMd, color: colors.muted },
  // Two by two: four cells in one row would truncate on a phone.
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  metaCell: {
    flexGrow: 1,
    flexBasis: "47%",
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
  },
  metaLabel: { ...type.labelMd, color: colors.faint },
  metaValue: { ...type.bodyMd, color: colors.text },

  callHint: {
    ...type.labelMd,
    color: colors.faint,
    textAlign: "center",
    marginTop: -spacing.xs,
  },

  formCard: { gap: spacing.md },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  timestamp: { ...type.labelMd, color: colors.faint },
  summary: { ...type.bodyXl, color: colors.text },
  toggle: { ...type.labelLg, color: colors.doctor },

  answers: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  answerRow: { gap: 2 },
  answerQuestion: { ...type.labelMd, color: colors.faint },
  answerValue: { ...type.bodyLg, color: colors.text },

  noteText: { ...type.bodyXl, color: colors.text },
  author: { ...type.labelMd, color: colors.muted },

  callout: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  calloutWarning: { backgroundColor: colors.warningTint },
  calloutSuccess: { backgroundColor: colors.successTint },
  calloutLabel: { ...type.labelMd, color: colors.faint, letterSpacing: 0.6 },
  calloutBody: { ...type.bodyLg, color: colors.text },

  savedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.successTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  savedNoticeText: { ...type.labelLg, color: colors.success },

  followUpButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    minHeight: touch.min,
    borderWidth: 2,
    borderColor: colors.success,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  followUpButtonMuted: { borderColor: colors.borderStrong },
  followUpButtonText: { ...type.labelLg, color: colors.success },

  statusActions: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  statusButton: {
    justifyContent: "center",
    minHeight: touch.doctorAction,
    borderWidth: 2,
    borderColor: colors.doctor,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  statusButtonText: { ...type.labelLg, color: colors.doctor },
});
