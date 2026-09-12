import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge, Tone } from "@/components/ui";
import { QueueItem, TriageStatus } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { colors, radius, shadow, spacing } from "@/lib/theme";

export const TRIAGE_STATUS_META: Record<
  TriageStatus,
  { label: string; short: string; tone: Tone }
> = {
  WAITING: { label: "Waiting", short: "WAITING", tone: "warning" },
  IN_PROGRESS: { label: "In progress", short: "IN PROGRESS", tone: "doctor" },
  DONE: { label: "Done", short: "DONE", tone: "success" },
};

/** The status a doctor would move to next, and the label for that button. */
const NEXT_ACTION: Record<TriageStatus, { to: TriageStatus; label: string } | null> = {
  WAITING: { to: "IN_PROGRESS", label: "Start consult" },
  IN_PROGRESS: { to: "DONE", label: "Mark done" },
  DONE: { to: "WAITING", label: "Reopen" },
};

/** One row in the doctor queue / high-risk worklist. */
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
  const status = item.latest_triage_status;
  const statusMeta = status ? TRIAGE_STATUS_META[status] : null;
  const next = status ? NEXT_ACTION[status] : null;
  const fromPhone = item.latest_triage_source === "voice_call";

  return (
    <View style={[styles.card, item.is_high_risk && styles.cardHighRisk]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.is_high_risk ? <Badge label="HIGH RISK" tone="danger" /> : null}
        </View>

        <View style={styles.badgeRow}>
          <Text style={styles.code}>{item.unique_code}</Text>
          {statusMeta ? (
            <Badge label={statusMeta.short} tone={statusMeta.tone} />
          ) : null}
          <Badge
            label={fromPhone ? "📞 PHONE CALL" : "📱 APP"}
            tone={fromPhone ? "warning" : "neutral"}
          />
        </View>

        <Text style={styles.meta}>
          {item.age} years - {item.gender} - {item.village}
        </Text>

        {item.latest_triage_summary ? (
          <Text style={styles.summary} numberOfLines={2}>
            {item.latest_triage_summary}
          </Text>
        ) : (
          <Text style={styles.noTriage}>No symptom check submitted yet</Text>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {item.latest_triage_at
              ? `Last check ${timeAgo(item.latest_triage_at)}`
              : "Flagged by a doctor"}
          </Text>
          <Text style={styles.footerText}>
            {item.note_count} note{item.note_count === 1 ? "" : "s"}
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
            busy && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.statusActionText}>{next.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow,
  },
  cardHighRisk: { borderColor: "#F3C9C9", borderWidth: 1.5 },
  body: { padding: spacing.lg, gap: spacing.xs },
  pressed: { opacity: 0.85 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  code: { fontSize: 14, fontWeight: "700", color: colors.doctor, letterSpacing: 0.5 },
  meta: { fontSize: 13, color: colors.muted },
  summary: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  noTriage: { fontSize: 14, color: colors.faint, fontStyle: "italic" },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  footerText: { fontSize: 12, color: colors.faint, fontWeight: "600" },

  statusAction: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.doctorTint,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  statusActionText: { color: colors.doctor, fontWeight: "700", fontSize: 15 },
});
