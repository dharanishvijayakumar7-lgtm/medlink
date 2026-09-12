import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { QueueCard } from "@/components/queue-card";
import { EmptyState, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, QueueItem } from "@/lib/api";
import { colors, radius, spacing, touch, type } from "@/lib/theme";

function Telemetry({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.telemetry}>
      <Text style={styles.telemetryLabel}>{label}</Text>
      <Text style={styles.telemetryValue}>{value}</Text>
    </View>
  );
}

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

  const counts = useMemo(() => {
    const waiting = items.filter(
      (item) => item.latest_triage_status === "WAITING",
    ).length;
    const fromPhone = items.filter(
      (item) => item.latest_triage_source === "voice_call",
    ).length;
    const noTriage = items.filter((item) => item.latest_triage_id === null).length;
    return { waiting, fromPhone, noTriage };
  }, [items]);

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.banner}>
        <View style={styles.bannerTop}>
          <View style={styles.bannerIcon}>
            <Icon name="warning" size={26} color={colors.primaryFixed} />
          </View>
          <View style={styles.bannerHeading}>
            <Text style={styles.bannerTitle}>High-Risk Priority Worklist</Text>
            <Text style={styles.bannerSubtitle}>
              Maternal, child and chronic-condition follow-ups
            </Text>
          </View>
          <View style={styles.pendingPill}>
            <Text style={styles.pendingText}>{items.length} flagged</Text>
          </View>
        </View>

        <View style={styles.telemetryStrip}>
          <Telemetry label="Still waiting" value={`${counts.waiting}`} />
          <Telemetry label="From phone" value={`${counts.fromPhone}`} />
          <Telemetry label="No triage yet" value={`${counts.noTriage}`} />
        </View>
      </View>

      <View style={styles.noticeBar}>
        <View style={styles.noticeLeft}>
          <Icon name="emergency_home" size={20} color={colors.warning} />
          <Text style={styles.noticeText} numberOfLines={1}>
            {items.length} case{items.length === 1 ? "" : "s"} awaiting doctor review
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={load}
          style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.7 }]}
        >
          <Icon name="sync" size={18} color={colors.patient} />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {loading && items.length === 0 ? (
        <Loading label="Loading worklist..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon="verified_user"
          title="Nobody flagged yet"
          body="Flag a patient from their record to add them to this worklist."
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
  banner: {
    backgroundColor: colors.doctor,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  bannerTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerHeading: { flex: 1, minWidth: 0 },
  bannerTitle: { ...type.headlineMd, color: colors.onDoctor },
  bannerSubtitle: { ...type.labelMd, color: colors.secondaryFixed },
  pendingPill: {
    backgroundColor: colors.tertiaryContainer,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  pendingText: { ...type.labelMd, color: colors.onTertiary },

  telemetryStrip: { flexDirection: "row", gap: spacing.xs },
  telemetry: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  telemetryLabel: { ...type.labelMd, color: colors.secondaryFixed },
  telemetryValue: { ...type.headlineMd, color: colors.onDoctor },

  noticeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  noticeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  noticeText: { ...type.labelMd, color: colors.text, flex: 1 },
  refresh: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: touch.min,
    paddingHorizontal: spacing.sm,
  },
  refreshText: { ...type.labelMd, color: colors.patient },
});
