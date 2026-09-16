import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
import { translate, TranslationKey, useT } from "@/lib/i18n";
import { colors, overlay, radius, spacing, touch, type } from "@/lib/theme";

const ALL = "All";
const FILTERS = [ALL, "Waiting", "In progress", "Done"] as const;

const FILTER_TO_STATUS: Record<string, TriageStatus | null> = {
  [ALL]: null,
  Waiting: "WAITING",
  "In progress": "IN_PROGRESS",
  Done: "DONE",
};

const FILTER_LABEL: Record<string, TranslationKey> = {
  [ALL]: "queue.filterAll",
  Waiting: "status.waiting",
  "In progress": "status.inProgress",
  Done: "status.done",
};

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
  const { t } = useT();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(ALL);
  const [busyEntry, setBusyEntry] = useState<number | null>(null);

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
      setError(caught instanceof Error ? caught.message : translate("queue.loadFailed"));
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
          caught instanceof Error ? caught.message : translate("queue.updateFailed"),
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
      {/* Today at a glance */}
      <View style={styles.hero}>
        <Text style={styles.heroDoctor} numberOfLines={1}>
          {t("common.doctorName", { name: doctor.name })} ·{" "}
          {doctor.facility ? doctor.facility.name : t("queue.teleClinic")}
        </Text>
        <View style={styles.heroTop}>
          <Text style={styles.heroCountValue}>{counts.waiting}</Text>
          <Text style={styles.heroCountLabel}>{t("queue.inWaiting")}</Text>
        </View>
        <View style={styles.metricStrip}>
          <Metric
            label={t("queue.metricHighRisk")}
            value={`${counts.highRisk}`}
            accent={colors.tertiaryFixed}
          />
          <Metric
            label={t("queue.metricPhone")}
            value={`${counts.fromPhone}`}
            accent={colors.onPrimary}
          />
          <Metric
            label={t("queue.metricFollowUps")}
            value={`${followUps.length}`}
            accent={colors.primaryFixed}
          />
        </View>
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {followUps.length > 0 ? (
        <>
          <View style={styles.noticeBar}>
            <Icon name="emergency_home" size={20} color={colors.warning} />
            <Text style={styles.noticeText} numberOfLines={2}>
              {t("queue.followUpsAwaiting", { count: followUps.length })}
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
                {t(FILTER_LABEL[option])}
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
        <Loading label={t("queue.loading")} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="inbox"
          title={
            filter === ALL
              ? t("queue.emptyTitle")
              : t("queue.emptyFiltered", { status: t(FILTER_LABEL[filter]) })
          }
          body={filter === ALL ? t("queue.emptyBody") : t("queue.emptyFilteredBody")}
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

  hero: {
    backgroundColor: colors.doctor,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  heroDoctor: { ...type.labelMd, color: colors.secondaryFixed },
  heroTop: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  heroCountValue: { ...type.headlineXl, fontSize: 44, lineHeight: 52, color: colors.onDoctor },
  heroCountLabel: { ...type.headlineMd, color: colors.onDoctor, flex: 1 },

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
