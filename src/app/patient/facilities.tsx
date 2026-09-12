import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  Badge,
  Card,
  ChoiceChips,
  EmptyState,
  ErrorBanner,
  Loading,
  Screen,
} from "@/components/ui";
import { api, Facility, StockItem } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";

const ALL = "All";

function countAvailable(items: StockItem[]) {
  return items.filter((item) => item.available).length;
}

function StockLine({ items }: { items: StockItem[] }) {
  return (
    <View style={styles.stockList}>
      {items.map((item) => (
        <View key={item.id} style={styles.stockRow}>
          <Text style={[styles.stockMark, item.available ? styles.inStock : styles.outStock]}>
            {item.available ? "✓" : "✕"}
          </Text>
          <Text
            style={[styles.stockName, !item.available && styles.stockNameOut]}
            numberOfLines={1}
          >
            {item.item_name}
          </Text>
          <Text style={styles.stockState}>
            {item.available ? "In stock" : "Out of stock"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function FacilityCard({ facility }: { facility: Facility }) {
  const [open, setOpen] = useState(false);

  const medicines = facility.stock.filter((item) => item.item_type === "medicine");
  const diagnostics = facility.stock.filter((item) => item.item_type === "diagnostic");
  const lastUpdated = facility.stock.reduce<string | null>(
    (latest, item) => (!latest || item.updated_at > latest ? item.updated_at : latest),
    null,
  );

  return (
    <Card>
      <Badge label={facility.type.toUpperCase()} tone="patient" />
      <Text style={styles.name}>{facility.name}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaIcon}>📍</Text>
        <Text style={styles.meta}>{facility.area_label}</Text>
      </View>

      {facility.stock.length > 0 ? (
        <>
          <View style={styles.summaryRow}>
            <Text style={styles.summary}>
              💊 Medicines {countAvailable(medicines)}/{medicines.length}
            </Text>
            <Text style={styles.summary}>
              🔬 Tests {countAvailable(diagnostics)}/{diagnostics.length}
            </Text>
          </View>

          {open ? (
            <>
              {medicines.length > 0 ? (
                <>
                  <Text style={styles.groupLabel}>Medicines</Text>
                  <StockLine items={medicines} />
                </>
              ) : null}
              {diagnostics.length > 0 ? (
                <>
                  <Text style={styles.groupLabel}>Tests and diagnostics</Text>
                  <StockLine items={diagnostics} />
                </>
              ) : null}
              {lastUpdated ? (
                <Text style={styles.updated}>
                  Stock updated {formatDateTime(lastUpdated)}
                </Text>
              ) : null}
            </>
          ) : null}

          <Pressable onPress={() => setOpen(!open)} hitSlop={8}>
            <Text style={styles.toggle}>
              {open ? "Hide what is available" : "See what is available"}
            </Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.noStock}>No stock information yet.</Text>
      )}
    </Card>
  );
}

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
        Government health facilities near you, nearest first. Check what is in stock
        before you travel.
      </Text>

      {types.length > 2 ? (
        <ChoiceChips options={types} value={filter} onChange={setFilter} />
      ) : null}

      {visible.length === 0 ? (
        <EmptyState title="No facilities found" body="Pull down to refresh." />
      ) : (
        visible.map((facility) => (
          <FacilityCard key={facility.id} facility={facility} />
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

  summaryRow: {
    flexDirection: "row",
    gap: spacing.lg,
    flexWrap: "wrap",
    marginTop: spacing.xs,
  },
  summary: { fontSize: 14, fontWeight: "600", color: colors.text },

  groupLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: colors.faint,
    marginTop: spacing.sm,
  },
  stockList: {
    gap: spacing.xs,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  stockRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stockMark: { fontSize: 14, fontWeight: "900", width: 16 },
  inStock: { color: colors.success },
  outStock: { color: colors.danger },
  stockName: { flex: 1, fontSize: 14, color: colors.text },
  stockNameOut: { color: colors.muted, textDecorationLine: "line-through" },
  stockState: { fontSize: 12, color: colors.faint, fontWeight: "600" },

  updated: { fontSize: 12, color: colors.faint, marginTop: spacing.sm },
  toggle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.patient,
    paddingTop: spacing.sm,
  },
  noStock: { fontSize: 13, color: colors.faint, fontStyle: "italic" },
});
