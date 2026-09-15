import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
// Gesture-handler's Pressable hit-tests natively. React Native's measures the
// button on screen, and after Search ID > record > back that measurement comes
// back 88dp low (react-native-screens counts the header twice), so every tap on
// a small button here was cancelled.
import { Pressable } from "react-native-gesture-handler";

import { FollowUpCard } from "@/components/follow-up-card";
import { Icon } from "@/components/icon";
import { QueueCard } from "@/components/queue-card";
import { EmptyState, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, FollowUpItem, QueueItem, TriageStatus } from "@/lib/api";
import { useDoctorSession } from "@/lib/doctor-session";
import { colors, overlay, radius, spacing, touch, type } from "@/lib/theme";

const ALL = "All";
const FILTERS = [ALL, "Waiting", "In progress", "Done"] as const;

const FILTER_TO_STATUS: Record<string, TriageStatus | null> = {
  [ALL]: null,
  Waiting: "WAITING",
  "In progress": "IN_PROGRESS",
  Done: "DONE",
};

const NAV_ACTIONS: { label: string; icon: string; href: string }[] = [
  { label: "High-risk", icon: "warning", href: "/doctor/high-risk" },
  { label: "Search ID", icon: "search", href: "/doctor/search" },
  { label: "Stock", icon: "inventory_2", href: "/doctor/stock" },
  { label: "Dashboard", icon: "monitoring", href: "/doctor/dashboard" },
];

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

export default function DoctorQueue() {
  const router = useRouter();
  const { doctor } = useDoctorSession();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
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
      // Both lists drive this screen, so fetch them together and fail together.
      const [queue, due] = await Promise.all([
        api.getRecentQueue(),
        api.getFollowUpsDue(),
      ]);
      setItems(queue);
      setFollowUps(due);
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
      <View style={styles.statusRow}>
        <View style={styles.facilityPill}>
          <View style={styles.liveDot} />
          <Text style={styles.facilityText} numberOfLines={1}>
            {doctor.facility ? doctor.facility.name : "Tele-clinic"}
          </Text>
        </View>
        <View style={styles.liveRow}>
          <Icon name="sync" size={16} color={colors.muted} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      {/* Triage desk hero */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroHeading}>
            <View style={styles.heroLabelRow}>
              <Text style={styles.heroLabel}>TRIAGE DESK</Text>
              <View style={styles.heroDoctorPill}>
                <Text style={styles.heroDoctorText} numberOfLines={1}>
                  Dr. {doctor.name}
                </Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>Patient Triage Queue</Text>
          </View>
          <View style={styles.heroCount}>
            <Text style={styles.heroCountValue}>{counts.waiting}</Text>
            <Text style={styles.heroCountLabel}>In waiting</Text>
          </View>
        </View>

        <View style={styles.metricStrip}>
          <Metric
            label="High risk"
            value={`${counts.highRisk}`}
            accent={colors.tertiaryFixed}
          />
          <Metric
            label="From phone"
            value={`${counts.fromPhone}`}
            accent={colors.onPrimary}
          />
          <Metric
            label="Follow-ups due"
            value={`${followUps.length}`}
            accent={colors.primaryFixed}
          />
        </View>
      </View>

      {/* Clinical navigation */}
      <View style={styles.navRow}>
        {NAV_ACTIONS.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            // TEMP DEBUG: confirms the tap now completes.
            onPressIn={() => console.log("[debug] pressIn", action.label)}
            onPress={() => {
              console.log("[debug] press", action.label);
              router.push(action.href as never);
            }}
            style={({ pressed }) => [styles.navAction, pressed && styles.pressed]}
          >
            <Icon name={action.icon} size={22} color={colors.doctor} />
            <Text style={styles.navActionText}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {followUps.length > 0 ? (
        <>
          <View style={styles.noticeBar}>
            <Icon name="emergency_home" size={20} color={colors.warning} />
            <Text style={styles.noticeText} numberOfLines={1}>
              {followUps.length} follow-up{followUps.length === 1 ? "" : "s"} awaiting
              review
            </Text>
          </View>
          {followUps.map((item) => (
            <FollowUpCard
              key={item.note_id}
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
      ) : null}

      {/* Rapid segmentation toggles */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((option) => {
          const selected = option === filter;
          const count =
            FILTER_TO_STATUS[option] === null
              ? items.length
              : items.filter(
                  (item) => item.latest_triage_status === FILTER_TO_STATUS[option],
                ).length;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setFilter(option)}
              style={[styles.filterPill, selected && styles.filterPillOn]}
            >
              <Text style={[styles.filterText, selected && styles.filterTextOn]}>
                {option}
              </Text>
              <View style={[styles.filterCount, selected && styles.filterCountOn]}>
                <Text
                  style={[styles.filterCountText, selected && styles.filterTextOn]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && items.length === 0 ? (
        <Loading label="Loading queue..." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="inbox"
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
  pressed: { opacity: 0.9 },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  facilityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.patient,
  },
  facilityText: { ...type.labelMd, color: colors.muted, flexShrink: 1 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  liveText: { ...type.labelMd, color: colors.muted },

  hero: {
    backgroundColor: colors.doctor,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  heroHeading: { flex: 1, minWidth: 0, gap: spacing.xs },
  heroLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  heroLabel: { ...type.labelMd, color: colors.primaryFixed, letterSpacing: 1 },
  heroDoctorPill: {
    flexShrink: 1,
    backgroundColor: colors.secondaryFixed,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  heroDoctorText: { ...type.labelMd, color: colors.onSecondaryFixed },
  heroTitle: { ...type.headlineLg, color: colors.onDoctor },
  heroCount: { alignItems: "flex-end" },
  heroCountValue: { ...type.headlineXl, color: colors.primaryFixed },
  heroCountLabel: { ...type.labelMd, color: colors.secondaryFixed },

  metricStrip: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: overlay.scrim,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  metric: { flex: 1, gap: 2 },
  metricLabel: { ...type.labelMd, color: colors.secondaryFixedDim },
  metricValue: { ...type.headlineMd },

  navRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  navAction: {
    flexGrow: 1,
    flexBasis: "45%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    minHeight: touch.doctorAction,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.doctor,
  },
  navActionText: { ...type.labelLg, color: colors.doctor },

  noticeBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  noticeText: { ...type.labelMd, color: colors.text, flex: 1 },

  filterRow: { gap: spacing.xs, paddingRight: spacing.md },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: touch.chip,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceContainer,
  },
  filterPillOn: { backgroundColor: colors.doctor },
  filterText: { ...type.labelMd, color: colors.muted },
  filterTextOn: { color: colors.onDoctor },
  filterCount: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    minWidth: 22,
    alignItems: "center",
  },
  filterCountOn: { backgroundColor: overlay.onColorFill },
  filterCountText: { ...type.labelMd, color: colors.muted },
});
