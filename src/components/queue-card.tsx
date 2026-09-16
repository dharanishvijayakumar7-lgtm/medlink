import { StyleSheet, Text, View } from "react-native";
// Gesture-handler's Pressable: see the note in src/app/doctor/queue.tsx.
import { Pressable } from "react-native-gesture-handler";

import { Icon } from "@/components/icon";
import { Badge, SoftBadge, Tone } from "@/components/ui";
import { QueueItem, TriageStatus } from "@/lib/api";
import { ageShort, genderLabel, timeAgo } from "@/lib/format";
import { TranslationKey, useT } from "@/lib/i18n";
import { colors, elevation, radius, spacing, touch, type } from "@/lib/theme";

/** `label` and `short` are translation keys. */
export const TRIAGE_STATUS_META: Record<
  TriageStatus,
  { label: TranslationKey; short: TranslationKey; tone: Tone }
> = {
  WAITING: { label: "status.waiting", short: "status.waitingShort", tone: "warning" },
  IN_PROGRESS: {
    label: "status.inProgress",
    short: "status.inProgressShort",
    tone: "doctor",
  },
  DONE: { label: "status.done", short: "status.doneShort", tone: "success" },
};

/** The status a doctor would move to next, and the label for that button. */
const NEXT_ACTION: Record<
  TriageStatus,
  { to: TriageStatus; label: TranslationKey; icon: string }
> = {
  WAITING: { to: "IN_PROGRESS", label: "queue.startConsult", icon: "play_arrow" },
  IN_PROGRESS: { to: "DONE", label: "queue.markDone", icon: "check" },
  DONE: { to: "WAITING", label: "queue.reopen", icon: "restart_alt" },
};

/**
 * Doctor patient-row card. The left edge is colour-coded by triage level, per
 * DESIGN.md: amber for high risk / caution, green for normal.
 */
export function QueueCard({
  item,
  onPress,
  onSetStatus,
  busy,
}: {
  item: QueueItem;
  onPress: () => void;
  /** Omit to render the card without status controls. */
  onSetStatus?: (entryId: number, status: TriageStatus) => void;
  busy?: boolean;
}) {
  const { t } = useT();
  const status = item.latest_triage_status;
  const statusMeta = status ? TRIAGE_STATUS_META[status] : null;
  const next = status ? NEXT_ACTION[status] : null;
  const fromPhone = item.latest_triage_source === "voice_call";
  const edgeColor = item.is_high_risk ? colors.warning : colors.success;

  return (
    <View style={styles.card}>
      <View style={[styles.edge, { backgroundColor: edgeColor }]} />
      <View style={styles.inner}>
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        >
          <View style={styles.topRow}>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            {item.is_high_risk ? (
              <Badge label={t("common.highRisk")} tone="warning" icon="warning" />
            ) : null}
          </View>

          <View style={styles.badgeRow}>
            <Text style={styles.code}>{item.unique_code}</Text>
            {statusMeta ? (
              <SoftBadge label={t(statusMeta.short)} tone={statusMeta.tone} />
            ) : null}
            <View style={styles.sourceRow}>
              <Icon
                name={fromPhone ? "call" : "smartphone"}
                size={14}
                color={colors.muted}
              />
              <Text style={styles.sourceText}>
                {fromPhone ? t("call.channel.phone") : t("queue.sourceApp")}
              </Text>
            </View>
          </View>

          <Text style={styles.meta}>
            {ageShort(item.age_label)} · {genderLabel(item.gender)} · {item.village}
          </Text>

          {item.latest_triage_summary ? (
            <Text style={styles.summary} numberOfLines={2}>
              {item.latest_triage_summary}
            </Text>
          ) : (
            <Text style={styles.noTriage}>{t("queue.noTriage")}</Text>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {item.latest_triage_at
                ? t("queue.lastCheck", { time: timeAgo(item.latest_triage_at) })
                : t("queue.flaggedByDoctor")}
            </Text>
            <Text style={styles.footerText}>
              {t("queue.notes", { count: item.note_count })}
            </Text>
          </View>
        </Pressable>

        {onSetStatus && next && item.latest_triage_id !== null ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onSetStatus(item.latest_triage_id!, next.to)}
            style={({ pressed }) => [
              styles.statusAction,
              pressed && styles.pressed,
              busy && styles.busy,
            ]}
          >
            <Icon name={next.icon} size={20} color={colors.doctor} />
            <Text style={styles.statusActionText}>{t(next.label)}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...elevation.level1,
    flexDirection: "row",
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  /** Triage level, readable at a glance down a long list. */
  edge: { width: 6 },
  inner: { flex: 1 },
  body: { padding: spacing.md, gap: spacing.xs },
  pressed: { opacity: 0.9 },
  busy: { opacity: 0.5 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  name: { flex: 1, ...type.headlineMd, color: colors.text },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  code: { ...type.labelLg, color: colors.doctor, letterSpacing: 0.5 },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  sourceText: { ...type.labelMd, color: colors.muted },
  meta: { ...type.bodyMd, color: colors.muted },
  summary: { ...type.bodyLg, color: colors.text, marginTop: spacing.xs },
  noTriage: { ...type.bodyMd, color: colors.faint, fontStyle: "italic" },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  footerText: { ...type.labelMd, color: colors.faint },

  statusAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    minHeight: touch.doctorAction,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.doctorTint,
  },
  statusActionText: { ...type.labelLg, color: colors.doctor },
});
