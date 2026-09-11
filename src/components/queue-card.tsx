import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge } from "@/components/ui";
import { QueueItem } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { colors, radius, shadow, spacing } from "@/lib/theme";

/** One row in the doctor queue / high-risk worklist. */
export function QueueCard({
  item,
  onPress,
}: {
  item: QueueItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        item.is_high_risk && styles.cardHighRisk,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.is_high_risk ? <Badge label="HIGH RISK" tone="danger" /> : null}
      </View>

      <Text style={styles.code}>{item.unique_code}</Text>
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
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow,
  },
  cardHighRisk: { borderColor: "#F3C9C9", borderWidth: 1.5 },
  pressed: { opacity: 0.85 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text },
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
});
