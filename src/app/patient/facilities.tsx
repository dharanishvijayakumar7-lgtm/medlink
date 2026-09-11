import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  Badge,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorBanner,
  Loading,
  Screen,
} from "@/components/ui";
import { api, Facility } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";

const ALL = "All";

export default function NearbyFacilities() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(ALL);

  // No synchronous setState, so this is safe to call straight from an effect.
  const load = useCallback(async () => {
    try {
      setFacilities(await api.getFacilities());
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load nearby facilities.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Pull-to-refresh and retry come from event handlers, where showing the
  // spinner immediately is fine.
  const refresh = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const types = useMemo(
    () => [ALL, ...Array.from(new Set(facilities.map((item) => item.type)))],
    [facilities],
  );

  const visible =
    filter === ALL ? facilities : facilities.filter((item) => item.type === filter);

  if (loading && facilities.length === 0) return <Loading label="Loading facilities..." />;

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

      <Text style={styles.intro}>
        Government health facilities serving your area, nearest first.
      </Text>

      {types.length > 2 ? (
        <ChoiceChips options={types} value={filter} onChange={setFilter} />
      ) : null}

      {visible.length === 0 ? (
        <EmptyState title="No facilities found" body="Pull down to refresh." />
      ) : (
        visible.map((facility) => (
          <Card key={facility.id}>
            <Badge label={facility.type.toUpperCase()} tone="patient" />
            <Text style={styles.name}>{facility.name}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>📍</Text>
              <Text style={styles.meta}>{facility.area_label}</Text>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  name: { fontSize: 17, fontWeight: "700", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaIcon: { fontSize: 13 },
  meta: { fontSize: 14, color: colors.muted },
});
