import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DueDateField } from "@/components/due-date-field";
import { FacilityPicker } from "@/components/facility-picker";
import { Icon } from "@/components/icon";
import { TRIAGE_STATUS_META } from "@/components/queue-card";
import { ReferralCard } from "@/components/referral-card";
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
  Referral,
  ReferralStatus,
  TriageEntry,
} from "@/lib/api";
import {
  describeDueDate,
  formatDateTime,
  formatIsoDate,
  isValidIsoDate,
} from "@/lib/format";
import { useDoctorSession } from "@/lib/doctor-session";
import { isWebRtcAvailable } from "@/lib/livekit";
import { colors, elevation, radius, spacing, touch, type } from "@/lib/theme";

/** Statuses a doctor can move a referral to, beyond the one it already has. */
const NEXT_STATUSES: ReferralStatus[] = ["CONFIRMED", "COMPLETED", "NO_SHOW"];

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
  const [expanded, setExpanded] = useState(false);
  const statusMeta = TRIAGE_STATUS_META[entry.status];
  const fromPhone = entry.source === "voice_call";

  return (
    <Card>
      <View style={styles.badgeRow}>
        <SoftBadge label={statusMeta.short} tone={statusMeta.tone} />
        <SoftBadge label={fromPhone ? "PHONE CALL" : "APP"} tone="neutral" />
        <Text style={styles.timestamp}>{formatDateTime(entry.created_at)}</Text>
      </View>
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
            {expanded ? "Hide answers" : `Show all ${entry.answers.length} answers`}
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
  const due = note.follow_up_due_date;
  const overdue =
    due !== null && !note.follow_up_resolved && describeDueDate(due).includes("overdue");

  return (
    <Card clinical={note.is_high_risk}>
      <View style={styles.badgeRow}>
        {note.is_high_risk ? (
          <Badge label="HIGH RISK" tone="warning" icon="warning" />
        ) : null}
        {note.referred_to_facility ? (
          <SoftBadge label="REFERRED" tone="warning" />
        ) : null}
        {due !== null ? (
          <SoftBadge
            label={note.follow_up_resolved ? "FOLLOW-UP DONE" : "FOLLOW-UP OPEN"}
            tone={note.follow_up_resolved ? "success" : "warning"}
          />
        ) : null}
      </View>

      <Text style={styles.timestamp}>{formatDateTime(note.created_at)}</Text>
      <Text style={styles.noteText}>{note.note_text}</Text>

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
          <Text style={styles.calloutLabel}>FOLLOW-UP</Text>
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
              {note.follow_up_resolved ? "Reopen follow-up" : "Mark follow-up done"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.author}>
        Dr. {note.doctor.name} · {note.doctor.specialization}
      </Text>
    </Card>
  );
}

export default function DoctorPatientDetail() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { doctor } = useDoctorSession();

  const [record, setRecord] = useState<PatientRecord | null>(null);
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
      setRecord(await api.getPatientRecord(code));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the record.");
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
      setError(
        "Video calls need a development build (npx expo run:android). Expo Go has no WebRTC module.",
      );
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
        caught instanceof Error ? caught.message : "Could not start the consultation.",
      );
    } finally {
      setStartingCall(false);
    }
  }

  async function saveNote() {
    if (!doctor || !record) return;
    if (!noteText.trim()) {
      setNoteError("Please write the note before saving.");
      return;
    }

    const due = followUpDraft.trim();
    if (highRisk && due && !isValidIsoDate(due)) {
      setNoteError("The follow-up date must look like YYYY-MM-DD.");
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
        caught instanceof Error ? caught.message : "Could not save the note.",
      );
    } finally {
      setSavingNote(false);
    }
  }

  async function createReferral() {
    if (!doctor || !record) return;
    if (referralFacilityId === null) {
      setReferralError("Choose the facility you are referring to.");
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
        caught instanceof Error ? caught.message : "Could not create the referral.",
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
        caught instanceof Error ? caught.message : "Could not close the follow-up.",
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
        caught instanceof Error ? caught.message : "Could not reopen the follow-up.",
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
        caught instanceof Error ? caught.message : "Could not update the referral.",
      );
    } finally {
      setBusyReferral(null);
    }
  }

  if (!doctor) return <Loading />;
  if (loading && !record) return <Loading label="Loading record..." />;

  if (error && !record) {
    return (
      <Screen>
        <ErrorBanner message={error} onRetry={load} />
        <Button title="Back" onPress={() => router.back()} tone="doctor" variant="outline" />
      </Screen>
    );
  }

  const flagged = record?.notes.some((note) => note.is_high_risk) ?? false;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <Stack.Screen options={{ title: record?.unique_code ?? "Patient record" }} />

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
                    {record.age}
                    {record.gender.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.idChip}>
                <Text style={styles.idChipText}>{record.unique_code}</Text>
              </View>
            </View>
          </View>

          <View style={styles.badgeRow}>
            {flagged ? <Badge label="HIGH RISK" tone="warning" icon="warning" /> : null}
            {record.queue_position !== null ? (
              <SoftBadge label={`#${record.queue_position} IN QUEUE`} tone="doctor" />
            ) : null}
          </View>

          <View style={styles.metaGrid}>
            <MetaCell label="Village" value={record.village} />
            <MetaCell label="Phone" value={record.phone} />
            <MetaCell label="Language" value={record.preferred_language} />
          </View>
        </View>
      ) : null}

      <Button
        title="Start video consultation"
        icon="videocam"
        onPress={startCall}
        loading={startingCall}
        tone="success"
      />
      <Text style={styles.callHint}>
        {isWebRtcAvailable
          ? "Opens a room on the same LiveKit project as the voice agent. The patient sees a Join prompt on their home screen."
          : "Unavailable in Expo Go - run a development build to make consultations work."}
      </Text>

      <SectionTitle>Add consultation note</SectionTitle>
      <Card style={styles.formCard}>
        {noteError ? <ErrorBanner message={noteError} /> : null}
        {savedNote ? (
          <View style={styles.savedNotice}>
            <Icon name="check_circle" size={20} color={colors.success} />
            <Text style={styles.savedNoticeText}>Note saved</Text>
          </View>
        ) : null}

        <TextField
          label="Note"
          labelIcon="clinical_notes"
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Assessment, advice, medication given..."
          multiline
        />

        <Checkbox
          label="Flag as high-risk / needs follow-up"
          value={highRisk}
          onValueChange={setHighRisk}
          tone="warning"
        />

        {highRisk ? (
          <>
            <TextField
              label="Reason for follow-up"
              value={riskReason}
              onChangeText={setRiskReason}
              placeholder="e.g. Third trimester with high BP - review in 7 days"
              multiline
            />
            <DueDateField value={followUpDraft} onChange={setFollowUpDraft} />
          </>
        ) : null}

        <Button
          title="Save note"
          icon="save"
          onPress={saveNote}
          loading={savingNote}
          tone="doctor"
        />
      </Card>

      <SectionTitle>Refer to a facility</SectionTitle>
      <Card style={styles.formCard}>
        {referralError ? <ErrorBanner message={referralError} /> : null}
        <FacilityPicker
          label="Refer to"
          facilities={facilities}
          selectedId={referralFacilityId}
          onSelect={setReferralFacilityId}
          emptyLabel="Choose a facility"
          hint="The patient can follow this referral's status on their record."
        />
        <TextField
          label="Referral note (optional)"
          value={referralNotes}
          onChangeText={setReferralNotes}
          placeholder="Why you are referring, what they should ask for"
          multiline
        />
        <Button
          title="Create referral"
          icon="send"
          onPress={createReferral}
          loading={savingReferral}
          tone="doctor"
        />
      </Card>

      {record && record.referrals.length > 0 ? (
        <>
          <SectionTitle>Referrals</SectionTitle>
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
                        {status === "NO_SHOW"
                          ? "No show"
                          : status.charAt(0) + status.slice(1).toLowerCase()}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            </ReferralCard>
          ))}
        </>
      ) : null}

      <SectionTitle>Triage history</SectionTitle>
      {record && record.triage_entries.length > 0 ? (
        record.triage_entries.map((entry) => (
          <TriageCard key={entry.id} entry={entry} />
        ))
      ) : (
        <EmptyState icon="monitor_heart" title="No symptom checks yet" />
      )}

      <SectionTitle>Past notes</SectionTitle>
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
        <EmptyState icon="clinical_notes" title="No notes yet" />
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

  metaGrid: { flexDirection: "row", gap: spacing.xs },
  metaCell: {
    flex: 1,
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
