import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { QueueCard } from "@/components/queue-card";
import {
  Button,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorBanner,
  Loading,
  Screen,
} from "@/components/ui";
import { api, QueueItem, TriageStatus } from "@/lib/api";
import { useDoctorSession } from "@/lib/doctor-session";
import { colors, spacing } from "@/lib/theme";

const ALL = "All";
const FILTERS = [ALL, "Waiting", "In progress", "Done"] as const;

const FILTER_TO_STATUS: Record<string, TriageStatus | null> = {
  [ALL]: null,
  Waiting: "WAITING",
  "In progress": "IN_PROGRESS",
  Done: "DONE",
};

export default function DoctorQueue() {
  const router = useRouter();
  const { doctor } = useDoctorSession();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(ALL);
  const [busyEntry, setBusyEntry] = useState<number | null>(null);

  // The doctor session is in-memory, so a reload drops it - send them back.
  useEffect(() => {
    if (!doctor) router.replace("/doctor");
  }, [doctor, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.getRecentQueue());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const setStatus = useCallback(
    async (entryId: number, status: TriageStatus) => {
      setBusyEntry(entryId);
      try {
        await api.updateTriageStatus(entryId, status);
        await load();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not update the status.",
        );
      } finally {
        setBusyEntry(null);
      }
    },
    [load],
  );

  const counts = useMemo(() => {
    const waiting = items.filter(
      (item) => item.latest_triage_status === "WAITING",
    ).length;
    const highRisk = items.filter((item) => item.is_high_risk).length;
    const fromPhone = items.filter(
      (item) => item.latest_triage_source === "voice_call",
    ).length;
    return { waiting, highRisk, fromPhone };
  }, [items]);

  if (!doctor) return <Loading />;

  const wanted = FILTER_TO_STATUS[filter];
  const visible = wanted
    ? items.filter((item) => item.latest_triage_status === wanted)
    : items;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <Card>
        <Text style={styles.onDuty}>On duty</Text>
        <Text style={styles.doctorName}>Dr. {doctor.name}</Text>
        <Text style={styles.meta}>
          {doctor.specialization}
          {doctor.facility ? ` - ${doctor.facility.name}` : ""}
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button
          title="High-risk"
          onPress={() => router.push("/doctor/high-risk")}
          tone="danger"
          variant="outline"
          style={styles.actionButton}
        />
        <Button
          title="Search ID"
          onPress={() => router.push("/doctor/search")}
          tone="doctor"
          variant="outline"
          style={styles.actionButton}
        />
        <Button
          title="Stock"
          onPress={() => router.push("/doctor/stock")}
          tone="doctor"
          variant="outline"
          style={styles.actionButton}
        />
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      <Text style={styles.countLine}>
        {counts.waiting} waiting
        {counts.highRisk > 0 ? ` - ${counts.highRisk} high-risk` : ""}
        {counts.fromPhone > 0 ? ` - ${counts.fromPhone} from phone calls` : ""}
      </Text>

      <ChoiceChips
        options={FILTERS}
        value={filter}
        onChange={setFilter}
        tone="doctor"
      />

      {loading && items.length === 0 ? (
        <Loading label="Loading queue..." />
      ) : visible.length === 0 ? (
        <EmptyState
          title={filter === ALL ? "Queue is empty" : `Nobody is ${filter.toLowerCase()}`}
          body={
            filter === ALL
              ? "Patients appear here after a symptom check, in the app or over the phone."
              : "Try a different filter."
          }
        />
      ) : (
        visible.map((item) => (
          <QueueCard
            key={item.unique_code}
            item={item}
            busy={busyEntry === item.latest_triage_id}
            onSetStatus={setStatus}
            onPress={() =>
              router.push({
                pathname: "/doctor/patient/[code]",
                params: { code: item.unique_code },
              })
            }
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  onDuty: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.faint,
  },
  doctorName: { fontSize: 20, fontWeight: "700", color: colors.text },
  meta: { fontSize: 14, color: colors.muted },

  actions: { flexDirection: "row", gap: spacing.sm },
  actionButton: { flex: 1, paddingHorizontal: spacing.sm },

  countLine: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    marginTop: spacing.sm,
  },
});
