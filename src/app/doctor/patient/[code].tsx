import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
import { api, ConsultationNote, Facility, PatientRecord, TriageEntry } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useDoctorSession } from "@/lib/doctor-session";
import { colors, radius, spacing } from "@/lib/theme";

function TriageCard({ entry }: { entry: TriageEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
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
        </View>
      ) : null}

      <Text style={styles.author}>
        Dr. {note.doctor.name} - {note.doctor.specialization}
      </Text>
    </Card>
  );
}

function FacilityPicker({
  facilities,
  selectedId,
  onSelect,
}: {
  facilities: Facility[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = facilities.find((facility) => facility.id === selectedId) ?? null;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Refer to facility (optional)</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(!open)}
        style={styles.pickerTrigger}
      >
        <Text
          style={[styles.pickerValue, !selected && styles.pickerPlaceholder]}
          numberOfLines={1}
        >
          {selected ? selected.name : "No referral"}
        </Text>
        <Text style={styles.pickerChevron}>{open ? "⌃" : "⌄"}</Text>
      </Pressable>

      {open ? (
        <View style={styles.pickerList}>
          <Pressable
            onPress={() => {
              onSelect(null);
              setOpen(false);
            }}
            style={styles.pickerRow}
          >
            <View style={[styles.radio, selectedId === null && styles.radioOn]} />
            <Text style={styles.pickerRowText}>No referral</Text>
          </Pressable>

          {facilities.map((facility) => (
            <Pressable
              key={facility.id}
              onPress={() => {
                onSelect(facility.id);
                setOpen(false);
              }}
              style={styles.pickerRow}
            >
              <View
                style={[styles.radio, selectedId === facility.id && styles.radioOn]}
              />
              <View style={styles.pickerRowBody}>
                <Text style={styles.pickerRowText}>{facility.name}</Text>
                <Text style={styles.pickerRowMeta}>
                  {facility.type} - {facility.area_label}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.hint}>
        Part 1 referrals are a note only - status tracking comes later.
      </Text>
    </View>
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
  const [facilityId, setFacilityId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    api.getFacilities().then(setFacilities).catch(() => setFacilities([]));
  }, []);

  async function saveNote() {
    if (!doctor || !record) return;
    if (!noteText.trim()) {
      setSaveError("Please write the note before saving.");
      return;
    }

    setSaveError(null);
    setSaving(true);
    try {
      await api.addConsultationNote(record.unique_code, {
        doctor_id: doctor.id,
        note_text: noteText.trim(),
        is_high_risk: highRisk,
        high_risk_reason: highRisk ? riskReason.trim() || null : null,
        referred_to_facility_id: facilityId,
      });
      setNoteText("");
      setHighRisk(false);
      setRiskReason("");
      setFacilityId(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await load();
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Could not save the note.");
    } finally {
      setSaving(false);
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
          </View>
          <Text style={styles.name}>{record.name}</Text>
          <Text style={styles.meta}>
            {record.age} years - {record.gender} - {record.village}
          </Text>
          <Text style={styles.meta}>
            Phone {record.phone} - speaks {record.preferred_language}
          </Text>
          <Text style={styles.meta}>
            Registered {formatDateTime(record.created_at)}
          </Text>
        </Card>
      ) : null}

      <SectionTitle>Add consultation note</SectionTitle>
      <Card>
        {saveError ? <ErrorBanner message={saveError} /> : null}
        {saved ? <Text style={styles.savedNotice}>{"✓"}  Note saved</Text> : null}

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

        <FacilityPicker
          facilities={facilities}
          selectedId={facilityId}
          onSelect={setFacilityId}
        />

        <Button
          title="Save note"
          onPress={saveNote}
          loading={saving}
          tone="doctor"
        />
      </Card>

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

  field: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  hint: { fontSize: 12, color: colors.muted },

  pickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  pickerValue: { flex: 1, fontSize: 16, color: colors.text },
  pickerPlaceholder: { color: colors.faint },
  pickerChevron: { fontSize: 18, color: colors.muted, fontWeight: "700" },

  pickerList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerRowBody: { flex: 1, gap: 2 },
  pickerRowText: { fontSize: 15, color: colors.text, fontWeight: "500" },
  pickerRowMeta: { fontSize: 12, color: colors.muted },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioOn: { borderColor: colors.doctor, borderWidth: 6 },
});
