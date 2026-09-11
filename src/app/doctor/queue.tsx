import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { QueueCard } from "@/components/queue-card";
import { Button, Card, EmptyState, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, QueueItem } from "@/lib/api";
import { useDoctorSession } from "@/lib/doctor-session";
import { colors, spacing } from "@/lib/theme";

export default function DoctorQueue() {
  const router = useRouter();
  const { doctor } = useDoctorSession();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (!doctor) return <Loading />;

  const highRiskCount = items.filter((item) => item.is_high_risk).length;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <Card>
        <Text style={styles.onDuty}>On duty</Text>
        <Text style={styles.doctorName}>Dr. {doctor.name}</Text>
        <Text style={styles.meta}>{doctor.specialization}</Text>
      </Card>

      <View style={styles.actions}>
        <Button
          title="High-risk worklist"
          onPress={() => router.push("/doctor/high-risk")}
          tone="danger"
          variant="outline"
          style={styles.actionButton}
        />
        <Button
          title="Search by ID"
          onPress={() => router.push("/doctor/search")}
          tone="doctor"
          variant="outline"
          style={styles.actionButton}
        />
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      <Text style={styles.countLine}>
        {items.length} patient{items.length === 1 ? "" : "s"} with recent symptom
        checks
        {highRiskCount > 0 ? ` - ${highRiskCount} flagged high-risk` : ""}
      </Text>

      {loading && items.length === 0 ? (
        <Loading label="Loading queue..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="Queue is empty"
          body="Patients appear here as soon as they submit a symptom check."
        />
      ) : (
        items.map((item) => (
          <QueueCard
            key={item.unique_code}
            item={item}
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

  actions: { flexDirection: "row", gap: spacing.md },
  actionButton: { flex: 1 },

  countLine: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    marginTop: spacing.sm,
  },
});
