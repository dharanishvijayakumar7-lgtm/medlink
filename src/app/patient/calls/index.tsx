import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { EmptyState, ErrorBanner, Loading, Screen, SoftBadge } from "@/components/ui";
import { api, CallSummary } from "@/lib/api";
import { formatCallDuration, urgencyMeta } from "@/lib/calls";
import { formatDateTime } from "@/lib/format";
import { usePatientSession } from "@/lib/patient-session";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";

function CallCard({ call, onPress }: { call: CallSummary; onPress: () => void }) {
  const urgency = urgencyMeta(call.urgency);
  const duration = formatCallDuration(call.duration_sec);
  const title = call.assessment?.category ?? call.chief_complaint ?? "Call to MedLink";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.callIcon}>
          <Icon name="phone_in_talk" size={26} color={colors.patient} />
        </View>
        <View style={styles.cardHeading}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.cardMeta}>
            {call.started_at ? formatDateTime(call.started_at) : "Date not known"}
            {duration ? ` · ${duration}` : ""}
          </Text>
        </View>
        <Icon name="chevron_right" size={24} color={colors.faint} />
      </View>
      {urgency ? <SoftBadge label={urgency.label} tone={urgency.tone} /> : null}
      {call.summary_text ? (
        <Text style={styles.summary} numberOfLines={2}>
          {call.summary_text}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Summaries of the patient's calls to the MedLink voice agent, newest first. */
export default function CallHistory() {
  const router = useRouter();
  const { session } = usePatientSession();
  const code = session?.unique_code ?? "";

  const [calls, setCalls] = useState<CallSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // No synchronous setState, so it is safe to call from a focus effect.
  const fetchCalls = useCallback(async () => {
    if (!code) return;
    try {
      setCalls(await api.getPatientCalls(code));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your calls.");
    }
  }, [code]);

  useFocusEffect(
    useCallback(() => {
      fetchCalls();
    }, [fetchCalls]),
  );

  async function refresh() {
    setRefreshing(true);
    await fetchCalls();
    setRefreshing(false);
  }

  if (calls === null && !error) return <Loading label="Loading your calls..." />;

  const lastFour = session?.phone.replace(/\D/g, "").slice(-4);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.explainer}>
        <Icon name="support_agent" size={22} color={colors.patient} />
        <Text style={styles.explainerText}>
          Calls to the MedLink helpline from your registered number
          {lastFour ? ` ending ${lastFour}` : ""}.
        </Text>
      </View>

      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

      {calls === null ? null : calls.length === 0 ? (
        <EmptyState
          icon="phone_in_talk"
          title="No calls yet"
          body="When you call the MedLink helpline from your registered number, a summary of the call appears here."
        />
      ) : (
        calls.map((call) => (
          <CallCard
            key={call.call_id}
            call={call}
            onPress={() =>
              router.push({
                pathname: "/patient/calls/[id]",
                params: { id: call.call_id },
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

  explainer: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  explainerText: { ...type.bodyLg, color: colors.text, flex: 1 },

  card: {
    ...elevation.level1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  callIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.tile,
    backgroundColor: colors.patientTint,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeading: { flex: 1, minWidth: 0 },
  cardTitle: { ...type.headlineMd, color: colors.text },
  cardMeta: { ...type.labelMd, color: colors.muted },
  summary: { ...type.bodyLg, color: colors.text },
});
