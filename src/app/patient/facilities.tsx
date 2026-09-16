import * as Location from "expo-location";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LinkButton,
  Screen,
  TextField,
} from "@/components/ui";
import { api, ApiError, LocatedPlace, NearbyFacility } from "@/lib/api";
import { translate, TranslationKey, useT } from "@/lib/i18n";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";

/** The server searches this far; shown to the patient. */
const RADIUS_KM = 25;

type Kind = NearbyFacility["kind"];
const ALL = "all";
type Filter = typeof ALL | Kind;

const KIND_LABEL: Record<Kind, TranslationKey> = {
  hospital: "facilities.kind.hospital",
  clinic: "facilities.kind.clinic",
  health_centre: "facilities.kind.healthCentre",
};

const KIND_ICON: Record<Kind, string> = {
  hospital: "local_hospital",
  clinic: "medical_services",
  health_centre: "health_and_safety",
};

const FILTER_LABEL: Record<Kind, TranslationKey> = {
  hospital: "facilities.filter.hospitals",
  clinic: "facilities.filter.clinics",
  health_centre: "facilities.filter.healthCentres",
};

function distanceLabel(km: number): string {
  return km < 1
    ? translate("facilities.distanceM", { m: Math.max(50, Math.round((km * 1000) / 50) * 50) })
    : translate("facilities.distanceKm", { km: km.toFixed(1) });
}

function FacilityCard({ facility }: { facility: NearbyFacility }) {
  const { t } = useT();
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardHeading}>
          <View style={styles.typeChip}>
            <Text style={styles.typeChipText}>{t(KIND_LABEL[facility.kind]).toUpperCase()}</Text>
          </View>
          {/* Place names are shown as they are on the map, never translated. */}
          <Text style={styles.facilityName}>{facility.name}</Text>
        </View>
        <View style={styles.facilityIcon}>
          <Icon name={KIND_ICON[facility.kind]} size={24} color={colors.patient} />
        </View>
      </View>

      <View style={styles.distanceRow}>
        <Icon name="near_me" size={20} color={colors.patient} />
        <Text style={styles.distanceText}>{distanceLabel(facility.distance_km)}</Text>
      </View>

      {facility.address ? <Text style={styles.address}>{facility.address}</Text> : null}
    </View>
  );
}

/**
 * Real clinics and hospitals near a place the patient chooses - their current
 * location or a village, town or PIN code they type - from OpenStreetMap.
 */
export default function NearbyFacilities() {
  const { t } = useT();
  const [place, setPlace] = useState<LocatedPlace | null>(null);
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [facilities, setFacilities] = useState<NearbyFacility[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(ALL);

  const loadNearby = useCallback(async (at: LocatedPlace) => {
    setLoading(true);
    setError(null);
    try {
      setFacilities(await api.getNearbyFacilities(at.latitude, at.longitude));
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 503
          ? translate("facilities.unavailable")
          : caught instanceof Error
            ? caught.message
            : translate("facilities.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  function choose(next: LocatedPlace) {
    setPlace(next);
    setChanging(false);
    setFilter(ALL);
    setFacilities(null);
    loadNearby(next);
  }

  async function useCurrentLocation() {
    setError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError(t("facilities.permissionDenied"));
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      // A readable name if the phone can find one; the list works without it.
      let label = t("facilities.currentLocation");
      try {
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        label =
          address?.city || address?.district || address?.subregion || address?.region || label;
      } catch {
        // Keep the generic label.
      }
      choose({ latitude, longitude, label });
    } catch {
      setError(t("sos.locationFailed"));
    } finally {
      setLocating(false);
    }
  }

  async function searchPlace() {
    const text = query.trim();
    if (text.length < 2) {
      setError(t("facilities.typePlace"));
      return;
    }
    setError(null);
    setSearching(true);
    try {
      choose(await api.locatePlace(text));
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 404
          ? t("facilities.notFound")
          : caught instanceof ApiError && caught.status >= 500
            ? t("facilities.searchUnavailable")
            : caught instanceof Error
              ? caught.message
              : t("common.somethingWrong"),
      );
    } finally {
      setSearching(false);
    }
  }

  const refresh = useCallback(() => {
    if (place) loadNearby(place);
  }, [place, loadNearby]);

  const kinds = useMemo(
    () => (["hospital", "clinic", "health_centre"] as Kind[]).filter((kind) =>
      (facilities ?? []).some((item) => item.kind === kind),
    ),
    [facilities],
  );

  const choosing = place === null || changing;
  const list = facilities ?? [];
  const visible = filter === ALL ? list : list.filter((item) => item.kind === filter);

  return (
    <Screen
      refreshing={loading && facilities !== null}
      onRefresh={place && !choosing ? refresh : undefined}
      contentStyle={styles.content}
    >
      <View style={styles.locationBanner}>
        <View style={styles.locationRow}>
          <Icon name="location_on" size={20} color={colors.patient} />
          <Text style={styles.locationText}>{t("facilities.network")}</Text>
        </View>
        <Text style={styles.bannerTitle}>{t("facilities.bannerTitle")}</Text>
        <Text style={styles.bannerBody}>{t("facilities.bannerBody")}</Text>
      </View>

      {choosing ? (
        <Card style={styles.chooser}>
          <Text style={styles.chooserTitle}>{t("facilities.locationTitle")}</Text>
          <Button
            title={t("facilities.useCurrent")}
            icon="my_location"
            onPress={useCurrentLocation}
            loading={locating}
            disabled={searching}
            tone="patient"
          />
          <Text style={styles.or}>{t("facilities.or")}</Text>
          <TextField
            label={t("facilities.searchLabel")}
            labelIcon="search"
            value={query}
            onChangeText={setQuery}
            placeholder={t("facilities.searchPlaceholder")}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={searchPlace}
          />
          <Button
            title={t("facilities.search")}
            icon="search"
            onPress={searchPlace}
            loading={searching}
            disabled={locating}
            tone="patient"
            variant="outline"
          />
          {place ? (
            <View style={styles.cancelRow}>
              <LinkButton
                title={t("facilities.cancelChange")}
                tone="patient"
                onPress={() => {
                  setChanging(false);
                  setError(null);
                }}
              />
            </View>
          ) : null}
        </Card>
      ) : (
        <View style={styles.placeRow}>
          <Icon name="my_location" size={22} color={colors.patient} />
          <Text style={styles.placeText}>
            {t("facilities.showingNear", { km: RADIUS_KM, place: place!.label })}
          </Text>
          <LinkButton
            title={t("facilities.change")}
            tone="patient"
            onPress={() => {
              setChanging(true);
              setError(null);
            }}
          />
        </View>
      )}

      {error ? (
        <ErrorBanner message={error} onRetry={!choosing && place ? refresh : undefined} />
      ) : null}

      {choosing ? null : loading && facilities === null ? (
        <View style={styles.loadingBox} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={colors.patient} />
          <Text style={styles.loadingTitle}>{t("facilities.loading")}</Text>
          <Text style={styles.loadingHint}>{t("facilities.slowHint")}</Text>
        </View>
      ) : facilities === null ? null : list.length === 0 ? (
        <EmptyState
          title={t("facilities.emptyTitle")}
          body={t("facilities.emptyBody")}
          icon="local_hospital"
        />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {([ALL, ...kinds] as Filter[]).map((option) => {
              const selected = option === filter;
              const label =
                option === ALL
                  ? t("facilities.all", { count: list.length })
                  : t(FILTER_LABEL[option], {
                      count: list.filter((item) => item.kind === option).length,
                    });
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

          {visible.map((facility) => (
            <FacilityCard key={facility.id} facility={facility} />
          ))}

          {/* Required by the OpenStreetMap licence. */}
          <Text style={styles.credit}>{t("facilities.osmCredit")}</Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },

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

  chooser: { gap: spacing.md },
  chooserTitle: { ...type.headlineMd, color: colors.text },
  or: { ...type.labelMd, color: colors.muted, textAlign: "center" },
  cancelRow: { alignItems: "center" },

  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.patientTint,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  placeText: { ...type.bodyMd, color: colors.onPrimaryFixed, flex: 1 },

  loadingBox: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  loadingTitle: { ...type.headlineMd, color: colors.text, textAlign: "center" },
  loadingHint: { ...type.bodyMd, color: colors.muted, textAlign: "center" },

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
  address: { ...type.bodyMd, color: colors.muted },

  credit: { ...type.labelMd, color: colors.faint, textAlign: "center" },
});
