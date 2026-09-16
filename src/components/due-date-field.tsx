import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Icon } from "@/components/icon";
import {
  describeDueDate,
  formatIsoDate,
  isoDateInDays,
  isValidIsoDate,
} from "@/lib/format";
import { TranslationKey, useT } from "@/lib/i18n";
import { colors, radius, spacing, touch, type } from "@/lib/theme";

/**
 * Pick when to see a patient again.
 *
 * Deliberately not a native date picker: presets cover almost every real case
 * ("check again in a week"), exact entry covers the rest, and neither needs
 * another native module in the build. Nothing here is auto-computed - the
 * doctor always chooses.
 *
 * `value` is the raw draft string, so the parent owns the state and can clear
 * the whole form in one place. It validates with `isValidIsoDate` before saving.
 */

const PRESETS: { label: TranslationKey; days: number }[] = [
  { label: "dueDate.in3Days", days: 3 },
  { label: "dueDate.in1Week", days: 7 },
  { label: "dueDate.in2Weeks", days: 14 },
  { label: "dueDate.in1Month", days: 30 },
];

export function DueDateField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const { t } = useT();
  const trimmed = value.trim();
  const valid = trimmed.length > 0 && isValidIsoDate(trimmed);
  const invalid = trimmed.length > 0 && !valid;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Icon name="event" size={20} color={colors.doctor} />
        <Text style={styles.label}>{label ?? t("dueDate.label")}</Text>
      </View>

      <View style={styles.chipRow}>
        {PRESETS.map((preset) => {
          const presetDate = isoDateInDays(preset.days);
          const selected = trimmed === presetDate;
          return (
            <Pressable
              key={preset.label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(selected ? "" : presetDate)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {t(preset.label)}
              </Text>
            </Pressable>
          );
        })}
        {trimmed.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange("")}
            style={styles.chip}
          >
            <Icon name="close" size={16} color={colors.warning} />
            <Text style={styles.clearText}>{t("common.clear")}</Text>
          </Pressable>
        ) : null}
      </View>

      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={t("dueDate.placeholder")}
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        style={[styles.input, invalid && styles.inputInvalid]}
      />

      {valid ? (
        <View style={styles.feedbackRow}>
          <Icon name="check_circle" size={16} color={colors.success} />
          <Text style={styles.valid}>
            {formatIsoDate(trimmed)} · {describeDueDate(trimmed)}
          </Text>
        </View>
      ) : invalid ? (
        <Text style={styles.error}>
          {t("dueDate.formatError", { example: isoDateInDays(7) })}
        </Text>
      ) : (
        <Text style={styles.hint}>{t("dueDate.hint")}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  label: { ...type.labelLg, color: colors.text, flex: 1 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: touch.chip,
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  chipSelected: { backgroundColor: colors.doctor, borderColor: colors.doctor },
  chipText: { ...type.labelMd, color: colors.muted },
  chipTextSelected: { color: colors.onDoctor },
  clearText: { ...type.labelMd, color: colors.warning },

  input: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: touch.patientAction,
    ...type.bodyLg,
    color: colors.text,
  },
  inputInvalid: { borderColor: colors.warning },

  feedbackRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  valid: { ...type.labelMd, color: colors.success },
  error: { ...type.labelMd, color: colors.warning },
  hint: { ...type.labelMd, color: colors.muted },
});
