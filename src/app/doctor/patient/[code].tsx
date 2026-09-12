import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FacilityPicker } from "@/components/facility-picker";
import { ReferralCard } from "@/components/referral-card";
import { TRIAGE_STATUS_META } from "@/components/queue-card";
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
import { formatDateTime } from "@/lib/format";
import { useDoctorSession } from "@/lib/doctor-session";
import { colors, radius, spacing } from "@/lib/theme";

/** Statuses a doctor can move a referral to, beyond the one it already has. */
const NEXT_STATUSES: ReferralStatus[] = ["CONFIRMED", "COMPLETED", "NO_SHOW"];

function TriageCard({ entry }: { entry: TriageEntry }) {
  const [expanded, setExpanded] = useState(false);
  const statusMeta = TRIAGE_STATUS_META[entry.status];
  const fromPhone = entry.source === "voice_call";

  return (
    <Card>
      <View style={styles.badgeRow}>
        <Badge label={statusMeta.short} tone={statusMeta.tone} />
        <Badge
          label={fromPhone ? "📞 PHONE CALL" : "📱 APP"}
          tone={fromPhone ? "warning" : "neutral"}
        />
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

      {entry.answers.length > 0 ? (
        <Pressable onPress={() => setExpanded(!expanded)} hitSlop={8}>
          <Text style={styles.toggle}>
            {expanded ? "Hide answers" : `Show all ${entry.answers.length} answers`}
          </Text>
        </Pressable>
      ) : null}
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
        </View>
      ) : null}

      <Text style={styles.author}>
        Dr. {note.doctor.name} - {note.doctor.specialization}
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
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  const [referralFacilityId, setReferralFacilityId] = useState<number | null>(null);
  const [referralNotes, setReferralNotes] = useState("");
  const [savingReferral, setSavingReferral] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [busyReferral, setBusyReferral] = useState<number | null>(null);

  const [startingCall, setStartingCall] = useState(false);

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

    setNoteError(null);
    setSavingNote(true);
    try {
      await api.addConsultationNote(record.unique_code, {
        doctor_id: doctor.id,
        note_text: noteText.trim(),
        is_high_risk: highRisk,
        high_risk_reason: highRisk ? riskReason.trim() || null : null,
      });
      setNoteText("");
      setHighRisk(false);
      setRiskReason("");
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
        <Card style={flagged ? styles.highRiskCard : undefined}>
          <View style={styles.badgeRow}>
            <Badge label={record.unique_code} tone="doctor" />
            {flagged ? <Badge label="HIGH RISK" tone="danger" /> : null}
            {record.queue_position !== null ? (
              <Badge label={`#${record.queue_position} IN QUEUE`} tone="warning" />
            ) : null}
          </View>
          <Text style={styles.name}>{record.name}</Text>
          <Text style={styles.meta}>
            {record.age} years - {record.gender} - {record.village}
          </Text>
          <Text style={styles.meta}>
            Phone {record.phone} - speaks {record.preferred_language}
          </Text>
        </Card>
      ) : null}

      <Button
        title="Start video consultation"
        onPress={startCall}
        loading={startingCall}
        tone="success"
      />
      <Text style={styles.callHint}>
        Opens a room on the same LiveKit project as the voice agent. The patient
        sees a Join prompt on their home screen.
      </Text>

      <SectionTitle>Add consultation note</SectionTitle>
      <Card>
        {noteError ? <ErrorBanner message={noteError} /> : null}
        {savedNote ? (
          <Text style={styles.savedNotice}>{"✓"}  Note saved</Text>
        ) : null}

        <TextField
          label="Note"
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Assessment, advice, medication given..."
          multiline
        />

        <Checkbox
          label="Flag as high-risk / needs follow-up"
          value={highRisk}
          onValueChange={setHighRisk}
        />

        {highRisk ? (
          <TextField
            label="Reason for follow-up"
            value={riskReason}
            onChangeText={setRiskReason}
            placeholder="e.g. Third trimester with high BP - review in 7 days"
            multiline
          />
        ) : null}

        <Button title="Save note" onPress={saveNote} loading={savingNote} tone="doctor" />
      </Card>

      <SectionTitle>Refer to a facility</SectionTitle>
      <Card>
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
                        {status === "NO_SHOW" ? "No show" : status.toLowerCase()}
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
        <EmptyState title="No symptom checks yet" />
      )}

      <SectionTitle>Past notes</SectionTitle>
      {record && record.notes.length > 0 ? (
        record.notes.map((note) => <NoteCard key={note.id} note={note} />)
      ) : (
        <EmptyState title="No notes yet" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: "700", color: colors.text },
  meta: { fontSize: 14, color: colors.muted },
  callHint: {
    fontSize: 12,
    color: colors.faint,
    textAlign: "center",
    lineHeight: 17,
    marginTop: -spacing.xs,
  },

  timestamp: { fontSize: 12, fontWeight: "600", color: colors.faint },
  summary: { fontSize: 16, color: colors.text, lineHeight: 22, fontWeight: "500" },
  toggle: { fontSize: 14, fontWeight: "600", color: colors.doctor, paddingTop: 2 },

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

  savedNotice: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.success,
    backgroundColor: colors.successTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  statusActions: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  statusButton: {
    borderWidth: 1.5,
    borderColor: colors.doctor,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  statusButtonText: {
    color: colors.doctor,
    fontWeight: "700",
    fontSize: 13,
    textTransform: "capitalize",
  },
});
