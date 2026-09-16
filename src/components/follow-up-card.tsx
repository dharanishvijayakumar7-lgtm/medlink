import { StyleSheet, Text, View } from "react-native";
// Gesture-handler's Pressable: see the note in src/app/doctor/queue.tsx.
import { Pressable } from "react-native-gesture-handler";

import { Icon } from "@/components/icon";
import { FollowUpItem } from "@/lib/api";
import { ageShort, formatIsoDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { colors, elevation, overlay, radius, spacing, type } from "@/lib/theme";

/**
 * One patient waiting on a check-in.
 *
 * Follows the high-risk worklist mockup: an amber banner across the top of the
 * card, then the patient body. Amber rather than red - an overdue follow-up is
 * a clinical warning, and DESIGN.md keeps red for life-threatening events.
 */
export function FollowUpCard({
  item,
  onPress,
}: {
  item: FollowUpItem;
  onPress: () => void;
}) {
  const { t } = useT();
  const overdue = item.days_overdue > 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.banner, !overdue && styles.bannerDueToday]}>
        <Icon
          name={overdue ? "notification_important" : "event"}
          size={20}
          color={colors.onWarning}
        />
        <Text style={styles.bannerText} numberOfLines={2}>
          {overdue
            ? t("followUp.overdueBanner", { count: item.days_overdue })
            : t("followUp.dueTodayBanner")}
        </Text>
        <View style={styles.bannerTag}>
          <Text style={styles.bannerTagText}>
            {formatIsoDate(item.follow_up_due_date)}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.avatar}>
            <Icon name="person" size={26} color={colors.doctor} />
          </View>
          <View style={styles.heading}>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.meta}>
              {item.unique_code} · {ageShort(item.age_label)} · {item.village}
            </Text>
          </View>
          <Icon name="chevron_right" size={24} color={colors.faint} />
        </View>

        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>{t("followUp.reason")}</Text>
          <Text style={styles.reasonText} numberOfLines={2}>
            {item.high_risk_reason?.trim() || item.note_text}
          </Text>
        </View>

        <Text style={styles.footer}>{t("followUp.setBy", { name: item.doctor_name })}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...elevation.level1,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  pressed: { opacity: 0.9 },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.warning,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bannerDueToday: { backgroundColor: colors.tertiaryContainer },
  bannerText: { ...type.labelLg, color: colors.onWarning, flex: 1 },
  bannerTag: {
    backgroundColor: overlay.onColorFill,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  bannerTagText: { ...type.labelMd, color: colors.onWarning },

  body: { padding: spacing.md, gap: spacing.sm },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.doctorTint,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { flex: 1, minWidth: 0 },
  name: { ...type.headlineMd, color: colors.text },
  meta: { ...type.bodyMd, color: colors.muted },

  reasonBox: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  reasonLabel: { ...type.labelMd, color: colors.muted },
  reasonText: { ...type.bodyLg, color: colors.text },

  footer: { ...type.labelMd, color: colors.faint },
});
