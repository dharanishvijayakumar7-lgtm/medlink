import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { EmptyState, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, Facility, StockItem } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";

const ALL = "All";

function countAvailable(items: StockItem[]) {
  return items.filter((item) => item.available).length;
}

function StockList({ items }: { items: StockItem[] }) {
  return (
    <View style={styles.stockList}>
      {items.map((item) => (
        <View key={item.id} style={styles.stockRow}>
          <Icon
            name={item.available ? "check_circle" : "cancel"}
            size={18}
            color={item.available ? colors.success : colors.warning}
          />
          <Text
            style={[styles.stockName, !item.available && styles.stockNameOut]}
            numberOfLines={1}
          >
            {item.item_name}
          </Text>
          <Text
            style={[
              styles.stockState,
              { color: item.available ? colors.success : colors.warning },
            ]}
          >
            {item.available ? "In stock" : "Out"}
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
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardHeading}>
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>{facility.type.toUpperCase()}</Text>
          </View>
          <Text style={styles.facilityName}>{facility.name}</Text>
        </View>
        <View style={styles.facilityIcon}>
          <Icon name="local_hospital" size={24} color={colors.patient} />
        </View>
      </View>

      <View style={styles.distanceRow}>
        <Icon name="near_me" size={20} color={colors.patient} />
        <Text style={styles.distanceText}>{facility.area_label}</Text>
      </View>

      {facility.stock.length > 0 ? (
        <>
          <View style={styles.badgeRow}>
            <View style={styles.stockBadge}>
              <Icon name="medication" size={16} color={colors.onPrimaryContainer} />
              <Text style={styles.stockBadgeText}>
                Medicines {countAvailable(medicines)}/{medicines.length}
              </Text>
            </View>
            <View style={styles.stockBadgeAlt}>
              <Icon name="vaccines" size={16} color={colors.onSecondaryContainer} />
              <Text style={styles.stockBadgeAltText}>
                Tests {countAvailable(diagnostics)}/{diagnostics.length}
              </Text>
            </View>
          </View>

          {open ? (
            <>
              {medicines.length > 0 ? (
                <>
                  <Text style={styles.groupLabel}>MEDICINES</Text>
                  <StockList items={medicines} />
                </>
              ) : null}
              {diagnostics.length > 0 ? (
                <>
                  <Text style={styles.groupLabel}>TESTS AND DIAGNOSTICS</Text>
                  <StockList items={diagnostics} />
                </>
              ) : null}
              {lastUpdated ? (
                <Text style={styles.updated}>
                  Stock updated {formatDateTime(lastUpdated)}
                </Text>
              ) : null}
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => setOpen(!open)}
            style={({ pressed }) => [styles.expandButton, pressed && styles.pressed]}
          >
            <Icon
              name={open ? "expand_less" : "expand_more"}
              size={24}
              color={colors.patient}
            />
            <Text style={styles.expandText}>
              {open ? "Hide what is available" : "See what is available"}
            </Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.noStock}>No stock information yet.</Text>
      )}
    </View>
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
    <Screen refreshing={loading} onRefresh={refresh} contentStyle={styles.content}>
      <View style={styles.locationBanner}>
        <View style={styles.locationRow}>
          <Icon name="location_on" size={20} color={colors.patient} />
          <Text style={styles.locationText}>Government health network</Text>
        </View>
        <Text style={styles.bannerTitle}>Nearest medical centres to you</Text>
        <Text style={styles.bannerBody}>
          Check what is in stock before you travel.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {types.map((option) => {
          const selected = option === filter;
          const label =
            option === ALL ? `All (${facilities.length})` : option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setFilter(option)}
              style={[styles.filterPill, selected && styles.filterPillOn]}
            >
              {option === ALL ? (
                <Icon
                  name="verified"
                  size={18}
                  color={selected ? colors.onPatient : colors.text}
                />
              ) : null}
              <Text style={[styles.filterText, selected && styles.filterTextOn]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

      {visible.length === 0 ? (
        <EmptyState
          title="No facilities found"
          body="Pull down to refresh."
          icon="local_hospital"
        />
      ) : (
        visible.map((facility) => (
          <FacilityCard key={facility.id} facility={facility} />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  pressed: { opacity: 0.9 },

  locationBanner: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  locationText: { ...type.labelMd, color: colors.patient },
  bannerTitle: { ...type.headlineMd, color: colors.text },
  bannerBody: { ...type.bodyMd, color: colors.muted },

  filterRow: { gap: spacing.xs, paddingRight: spacing.md },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceContainerHigh,
  },
  filterPillOn: { backgroundColor: colors.patient },
  filterText: { ...type.labelMd, color: colors.text },
  filterTextOn: { color: colors.onPatient },

  card: {
    ...elevation.level1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: "row", gap: spacing.xs },
  cardHeading: { flex: 1, minWidth: 0, gap: spacing.xs },
  typeChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  typeChipText: { ...type.labelMd, color: colors.muted, letterSpacing: 0.6 },
  facilityName: { ...type.headlineMd, color: colors.text },
  facilityIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.patientTint,
    alignItems: "center",
    justifyContent: "center",
  },

  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  distanceText: { ...type.bodyMd, color: colors.text, flex: 1 },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primaryContainer,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  stockBadgeText: { ...type.labelMd, color: colors.onPrimaryContainer },
  stockBadgeAlt: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.secondaryContainer,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  stockBadgeAltText: { ...type.labelMd, color: colors.onSecondaryContainer },

  groupLabel: {
    ...type.labelMd,
    color: colors.faint,
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  stockList: {
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  stockRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stockName: { flex: 1, ...type.bodyLg, color: colors.text },
  stockNameOut: { color: colors.muted, textDecorationLine: "line-through" },
  stockState: { ...type.labelMd },

  updated: { ...type.labelMd, color: colors.faint, marginTop: spacing.xs },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerHigh,
  },
  expandText: { ...type.labelLg, color: colors.patient },
  noStock: { ...type.bodyMd, color: colors.faint },
});
