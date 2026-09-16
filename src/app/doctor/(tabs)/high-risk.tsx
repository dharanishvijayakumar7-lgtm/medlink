import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { QueueCard } from "@/components/queue-card";
import { EmptyState, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, QueueItem } from "@/lib/api";
import { translate, useT } from "@/lib/i18n";
import { colors, overlay, radius, spacing, type } from "@/lib/theme";

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
  const { t } = useT();
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
        caught instanceof Error ? caught.message : translate("highRisk.loadFailed"),
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
            <Text style={styles.bannerTitle}>
              {t("highRisk.flagged", { count: items.length })}
            </Text>
            <Text style={styles.bannerSubtitle}>{t("highRisk.subtitle")}</Text>
          </View>
        </View>

        <View style={styles.telemetryStrip}>
          <Telemetry label={t("highRisk.stillWaiting")} value={`${counts.waiting}`} />
          <Telemetry label={t("queue.metricPhone")} value={`${counts.fromPhone}`} />
          <Telemetry label={t("highRisk.noTriage")} value={`${counts.noTriage}`} />
        </View>
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {loading && items.length === 0 ? (
        <Loading label={t("highRisk.loading")} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="verified_user"
          title={t("highRisk.emptyTitle")}
          body={t("highRisk.emptyBody")}
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: overlay.onColorFill,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerHeading: { flex: 1, minWidth: 0 },
  bannerTitle: { ...type.headlineMd, color: colors.onDoctor },
  bannerSubtitle: { ...type.labelMd, color: colors.secondaryFixed },
  telemetryStrip: { flexDirection: "row", gap: spacing.xs },
  telemetry: {
    flex: 1,
    alignItems: "center",
    backgroundColor: overlay.scrim,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  telemetryLabel: { ...type.labelMd, color: colors.secondaryFixed },
  telemetryValue: { ...type.headlineMd, color: colors.onDoctor },

});
