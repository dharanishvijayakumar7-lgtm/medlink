import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { QueueCard } from "@/components/queue-card";
import { EmptyState, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, QueueItem } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";

/** The doctor queue filtered to patients a doctor flagged for follow-up. */
export default function HighRiskWorklist() {
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.getHighRiskQueue());
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load the worklist.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <Text style={styles.intro}>
        Maternal, child and chronic-condition follow-ups flagged by a doctor.
      </Text>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {loading && items.length === 0 ? (
        <Loading label="Loading worklist..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nobody flagged yet"
          body="Flag a patient from their record to add them to this worklist."
        />
      ) : (
        <>
          <Text style={styles.countLine}>
            {items.length} patient{items.length === 1 ? "" : "s"} needing follow-up
          </Text>
          {items.map((item) => (
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
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  countLine: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    marginTop: spacing.sm,
  },
});
