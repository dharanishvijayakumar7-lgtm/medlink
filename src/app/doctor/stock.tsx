import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { FacilityPicker } from "@/components/facility-picker";
import {
  Card,
  EmptyState,
  ErrorBanner,
  Loading,
  Screen,
  SectionTitle,
} from "@/components/ui";
import { api, Facility, StockItem } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useDoctorSession } from "@/lib/doctor-session";
import { colors, spacing } from "@/lib/theme";

function StockRow({
  item,
  onToggle,
  busy,
}: {
  item: StockItem;
  onToggle: (item: StockItem, next: boolean) => void;
  busy: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.itemName}>{item.item_name}</Text>
        <Text style={[styles.itemState, item.available ? styles.inStock : styles.outStock]}>
          {item.available ? "In stock" : "Out of stock"}
        </Text>
      </View>
      <Switch
        value={item.available}
        disabled={busy}
        onValueChange={(next) => onToggle(item, next)}
        trackColor={{ true: colors.success, false: colors.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export default function FacilityStockScreen() {
  const { doctor } = useDoctorSession();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState<number | null>(
    doctor?.facility?.id ?? null,
  );
  // Keyed by facility so switching back and forth is instant, and so the
  // loading effect never has to clear state synchronously.
  const [stockByFacility, setStockByFacility] = useState<Record<number, StockItem[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFacilities = useCallback(async () => {
    try {
      const list = await api.getFacilities();
      setFacilities(list);
      setError(null);
      // Fall back to the first facility so the screen is never empty.
      setFacilityId((current) => current ?? list[0]?.id ?? null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load facilities.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFacilities();
    }, [loadFacilities]),
  );

  const items = facilityId === null ? [] : (stockByFacility[facilityId] ?? []);

  useEffect(() => {
    if (facilityId === null) return;
    let active = true;
    api
      .getFacilityStock(facilityId)
      .then((stock) => {
        if (active) {
          setStockByFacility((current) => ({ ...current, [facilityId]: stock }));
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Could not load stock.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [facilityId]);

  const toggle = useCallback(
    async (item: StockItem, next: boolean) => {
      if (facilityId === null) return;
      setBusyItem(item.id);
      const replace = (updated: StockItem) =>
        setStockByFacility((current) => ({
          ...current,
          [facilityId]: (current[facilityId] ?? []).map((row) =>
            row.id === updated.id ? updated : row,
          ),
        }));

      // Optimistic: the switch should move under the doctor's finger.
      replace({ ...item, available: next });
      try {
        replace(await api.updateStockItem(facilityId, item.id, next));
        setError(null);
      } catch (caught) {
        replace(item);
        setError(
          caught instanceof Error ? caught.message : "Could not save that change.",
        );
      } finally {
        setBusyItem(null);
      }
    },
    [facilityId],
  );

  if (loading && facilities.length === 0) return <Loading label="Loading stock..." />;

  const medicines = items.filter((item) => item.item_type === "medicine");
  const diagnostics = items.filter((item) => item.item_type === "diagnostic");
  const lastUpdated = items.reduce<string | null>(
    (latest, item) => (!latest || item.updated_at > latest ? item.updated_at : latest),
    null,
  );

  return (
    <Screen>
      <Text style={styles.intro}>
        What you mark here is what patients see on their facility finder before
        they travel.
      </Text>

      <FacilityPicker
        label="Facility"
        facilities={facilities}
        selectedId={facilityId}
        onSelect={setFacilityId}
        allowNone={false}
        emptyLabel="Choose a facility"
      />

      {error ? <ErrorBanner message={error} onRetry={loadFacilities} /> : null}

      {items.length === 0 ? (
        <EmptyState title="No stock items for this facility" />
      ) : (
        <>
          <SectionTitle>Medicines</SectionTitle>
          <Card style={styles.group}>
            {medicines.map((item) => (
              <StockRow
                key={item.id}
                item={item}
                onToggle={toggle}
                busy={busyItem === item.id}
              />
            ))}
          </Card>

          <SectionTitle>Tests and diagnostics</SectionTitle>
          <Card style={styles.group}>
            {diagnostics.map((item) => (
              <StockRow
                key={item.id}
                item={item}
                onToggle={toggle}
                busy={busyItem === item.id}
              />
            ))}
          </Card>

          {lastUpdated ? (
            <Text style={styles.updated}>
              Last change {formatDateTime(lastUpdated)}
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  group: { gap: 0, paddingVertical: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowBody: { flex: 1, gap: 2 },
  itemName: { fontSize: 16, color: colors.text, fontWeight: "500" },
  itemState: { fontSize: 13, fontWeight: "600" },
  inStock: { color: colors.success },
  outStock: { color: colors.danger },
  updated: { fontSize: 12, color: colors.faint, textAlign: "center" },
});
