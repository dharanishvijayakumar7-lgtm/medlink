import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { LANGUAGES, useT } from "@/lib/i18n";
import { colors, radius, spacing, touch, type } from "@/lib/theme";

/**
 * The app language, as large chips. Each is written in its own script so a
 * patient can find theirs without reading English; the English name sits
 * underneath for staff. Used on the welcome screen and in settings.
 */
export function LanguagePicker({ tone = "patient" }: { tone?: "patient" | "doctor" }) {
  const { t, language, setLanguage } = useT();
  const accent = tone === "doctor" ? colors.doctor : colors.patient;
  const onAccent = tone === "doctor" ? colors.onDoctor : colors.onPatient;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Icon name="translate" size={24} color={accent} />
        <Text style={styles.label}>{t("role.chooseLanguage")}</Text>
      </View>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {LANGUAGES.map((option) => {
          const selected = option.code === language;
          return (
            <Pressable
              key={option.code}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.native}, ${option.english}`}
              onPress={() => setLanguage(option.code)}
              style={({ pressed }) => [
                styles.chip,
                selected && { backgroundColor: accent, borderColor: accent },
                pressed && !selected && styles.pressed,
              ]}
            >
              <Text
                style={[styles.native, selected && { color: onAccent }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {option.native}
              </Text>
              {option.code === "en" ? null : (
                <Text style={[styles.english, selected && { color: onAccent }]}>
                  {option.english}
                </Text>
              )}
              {selected ? (
                <View style={styles.check}>
                  <Icon name="check_circle" size={20} color={onAccent} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { ...type.labelLg, color: colors.text, flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    // Two to a row: big targets, and room for the longer scripts.
    flexBasis: "46%",
    flexGrow: 1,
    minHeight: touch.row,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  pressed: { backgroundColor: colors.surfaceContainerLow },
  native: { ...type.headlineMd, color: colors.text },
  english: { ...type.labelMd, fontFamily: type.bodyLg.fontFamily, color: colors.muted },
  check: { position: "absolute", top: spacing.sm, right: spacing.sm },
});
