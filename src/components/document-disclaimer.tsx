import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { useT } from "@/lib/i18n";
import { colors, radius, spacing, type } from "@/lib/theme";

/**
 * Shown with every patient-facing extracted summary. The text comes from the
 * server (it is sent on each document), so the wording lives in one place.
 * Amber, not red: this is a caution, and red is reserved for emergencies.
 */
export function DocumentDisclaimer({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  const { t } = useT();
  return (
    <View
      style={[styles.box, compact && styles.compact]}
      accessibilityRole="text"
      accessibilityLabel={t("disclaimer.a11y", { text })}
    >
      <Icon name="info" size={compact ? 20 : 24} color={colors.warning} />
      <View style={styles.body}>
        <Text style={styles.lead}>{t("disclaimer.lead")}</Text>
        {compact ? null : <Text style={styles.text}>{text}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.warningTint,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.warning,
    padding: spacing.md,
  },
  compact: { paddingVertical: spacing.sm, alignItems: "center" },
  body: { flex: 1, gap: 2 },
  lead: { ...type.labelLg, color: colors.text },
  text: { ...type.bodyLg, color: colors.text },
});
