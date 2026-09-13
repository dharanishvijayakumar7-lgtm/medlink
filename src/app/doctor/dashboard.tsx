import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FacilityPicker } from "@/components/facility-picker";
import {
  Card,
  ChoiceChips,
  ErrorBanner,
  Loading,
  Screen,
  Tone,
  toneColor,
} from "@/components/ui";
import { api, Facility, FacilityDashboard, RateStat } from "@/lib/api";
import { formatIsoDate } from "@/lib/format";
import { useDoctorSession } from "@/lib/doctor-session";
import { colors, radius, spacing, type } from "@/lib/theme";

const WINDOWS = ["7 days", "30 days", "90 days", "1 year"] as const;
const WINDOW_DAYS: Record<string, number> = {
  "7 days": 7,
  "30 days": 30,
  "90 days": 90,
  "1 year": 365,
};

/**
 * Green once most things get done, amber below that. There is no red band:
 * DESIGN.md reserves red for life-threatening events, and a low completion
 * rate is a warning, not an emergency.
 */
function rateTone(rate: number | null): Tone {
  if (rate === null) return "neutral";
  return rate >= 0.75 ? "success" : "warning";
}

function StatCard({
  title,
  value,
  caption,
  tone = "doctor",
  footnote,
}: {
  title: string;
  value: string;
  caption: string;
  tone?: Tone;
  footnote?: string;
}) {
  return (
    <Card>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, { color: toneColor(tone) }]}>{value}</Text>
      <Text style={styles.statCaption}>{caption}</Text>
      {footnote ? <Text style={styles.statFootnote}>{footnote}</Text> : null}
    </Card>
  );
}

function RateCard({
  title,
  stat,
  emptyCaption,
}: {
  title: string;
  stat: RateStat;
  emptyCaption: string;
}) {
  // A null rate means nothing was due - showing 0% would read as a failure.
  if (stat.rate === null) {
    return (
      <StatCard
        title={title}
        value="--"
        caption={emptyCaption}
        tone="neutral"
      />
    );
  }

  return (
    <StatCard
      title={title}
      value={`${Math.round(stat.rate * 100)}%`}
      caption={`${stat.completed} of ${stat.total} completed`}
      tone={rateTone(stat.rate)}
    />
  );
}

export default function FacilityDashboardScreen() {
  const { doctor } = useDoctorSession();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState<number | null>(
    doctor?.facility?.id ?? null,
  );
  const [window, setWindow] = useState<string>("30 days");
  const [data, setData] = useState<FacilityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFacilities = useCallback(async () => {
    try {
      const list = await api.getFacilities();
      setFacilities(list);
      setFacilityId((current) => current ?? list[0]?.id ?? null);
      setError(null);
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

  const days = WINDOW_DAYS[window] ?? 30;

  useEffect(() => {
    if (facilityId === null) return;
    let active = true;
    api
      .getFacilityDashboard(facilityId, days)
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Could not load the dashboard.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [facilityId, days]);

  if (loading && facilities.length === 0) {
    return <Loading label="Loading dashboard..." />;
  }

  return (
    <Screen>
      <FacilityPicker
        label="Facility"
        facilities={facilities}
        selectedId={facilityId}
        onSelect={setFacilityId}
        allowNone={false}
        emptyLabel="Choose a facility"
      />

      <ChoiceChips
        label="Time window"
        options={WINDOWS}
        value={window}
        onChange={setWindow}
        tone="doctor"
      />

      {error ? <ErrorBanner message={error} onRetry={loadFacilities} /> : null}

      {data ? (
        <>
          <Text style={styles.range}>
            {formatIsoDate(data.from_date)} to {formatIsoDate(data.to_date)}
          </Text>

          <StatCard
            title="PATIENT LOAD"
            value={String(data.patient_load.value)}
            caption={`${data.patient_load.referred_patients} referred in - ${data.patient_load.seen_by_facility_doctors} seen by this facility's doctors`}
            tone="doctor"
            footnote={
              data.patient_load.is_proxy ? data.patient_load.basis : undefined
            }
          />

          <RateCard
            title="REFERRAL COMPLETION"
            stat={data.referral_completion_rate}
            emptyCaption="No referrals to this facility in this window."
          />

          <RateCard
            title="FOLLOW-UP COMPLETION"
            stat={data.follow_up_completion_rate}
            emptyCaption="No follow-ups fell due in this window."
          />

          <View style={styles.aside}>
            <Text style={styles.asideText}>
              {data.patient_load.stock_updates} stock update
              {data.patient_load.stock_updates === 1 ? "" : "s"} in this window.
            </Text>
          </View>
        </>
      ) : !error ? (
        <Loading label="Loading figures..." />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  range: { ...type.labelMd, color: colors.muted },

  // Same treatment as the "TRIAGE DESK" label and waiting count on the queue.
  statTitle: { ...type.labelMd, color: colors.muted, letterSpacing: 1 },
  statValue: { ...type.headlineXl },
  statCaption: { ...type.bodyLg, color: colors.muted },
  statFootnote: {
    ...type.labelMd,
    fontFamily: type.bodyLg.fontFamily,
    color: colors.muted,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },

  aside: { paddingVertical: spacing.sm },
  asideText: {
    ...type.labelMd,
    fontFamily: type.bodyLg.fontFamily,
    color: colors.muted,
    textAlign: "center",
  },
});
