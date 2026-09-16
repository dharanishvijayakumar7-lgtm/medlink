import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { LANGUAGES, LanguageCode, useT } from "@/lib/i18n";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";

type RoleCardProps = {
  icon: string;
  title: string;
  description: string;
  footnoteIcon: string;
  footnote: string;
  accent: string;
  tileBackground: string;
  onPress: () => void;
};

function RoleCard({
  icon,
  title,
  description,
  footnoteIcon,
  footnote,
  accent,
  tileBackground,
  onPress,
}: RoleCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: false }}
      onPress={onPress}
      style={({ pressed }) => [styles.roleCard, pressed && styles.pressed]}
    >
      <View style={styles.roleTop}>
        <View style={[styles.roleTile, { backgroundColor: tileBackground }]}>
          <Icon name={icon} size={36} color={accent} />
        </View>
        <Text style={[styles.roleTitle, { color: accent }]}>{title}</Text>
        <View style={styles.roleArrow}>
          <Icon name="arrow_forward" size={20} color={colors.faint} />
        </View>
      </View>

      <Text style={styles.roleDescription}>{description}</Text>

      <View style={styles.roleFootnote}>
        <Icon name={footnoteIcon} size={18} color={accent} />
        <Text style={[styles.roleFootnoteText, { color: accent }]}>{footnote}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Language chips, each written in its own script so a patient can find theirs
 * without reading English. The English name sits underneath for staff.
 */
function LanguagePicker({
  value,
  onChange,
  label,
}: {
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
  label: string;
}) {
  return (
    <View style={styles.languages}>
      <View style={styles.languageHeader}>
        <Icon name="translate" size={20} color={colors.patient} />
        <Text style={styles.languageLabel}>{label}</Text>
      </View>
      <View style={styles.languageGrid} accessibilityRole="radiogroup">
        {LANGUAGES.map((language) => {
          const selected = language.code === value;
          return (
            <Pressable
              key={language.code}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${language.native}, ${language.english}`}
              onPress={() => onChange(language.code)}
              style={({ pressed }) => [
                styles.languageChip,
                selected && styles.languageChipOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.languageNative, selected && styles.languageTextOn]}>
                {language.native}
              </Text>
              {language.code === "en" ? null : (
                <Text style={[styles.languageEnglish, selected && styles.languageTextOn]}>
                  {language.english}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** First screen on launch: choose a language, then a role. No fields, no accounts. */
export default function RoleSelect() {
  const router = useRouter();
  const { t, language, setLanguage } = useT();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.trustPill}>
          <Icon name="verified_user" size={18} color={colors.patient} />
          <Text style={styles.trustText}>{t("role.trust")}</Text>
        </View>

        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Icon name="health_and_safety" size={32} color={colors.patient} />
            <Text style={styles.brand}>{t("role.welcome")}</Text>
          </View>
          <Text style={styles.tagline}>{t("role.tagline")}</Text>
        </View>

        <LanguagePicker
          value={language}
          onChange={setLanguage}
          label={t("role.chooseLanguage")}
        />

        <View style={styles.banner}>
          <Text style={styles.bannerLabel}>{t("role.bannerLabel")}</Text>
          <Text style={styles.bannerText}>{t("role.bannerText")}</Text>
        </View>

        <View style={styles.roles} accessibilityRole="radiogroup">
          <RoleCard
            icon="person"
            title={t("role.patientTitle")}
            description={t("role.patientDescription")}
            footnoteIcon="mic"
            footnote={t("role.patientFootnote")}
            accent={colors.patient}
            tileBackground={colors.patientTint}
            onPress={() => router.push("/patient")}
          />
          <RoleCard
            icon="stethoscope"
            title={t("role.doctorTitle")}
            description={t("role.doctorDescription")}
            footnoteIcon="clinical_notes"
            footnote={t("role.doctorFootnote")}
            accent={colors.doctor}
            tileBackground={colors.doctorTint}
            onPress={() => router.push("/doctor")}
          />
        </View>

        <View style={styles.sunlight}>
          <Icon name="sunny" size={24} color={colors.faint} />
          <View style={styles.sunlightBody}>
            <Text style={styles.sunlightTitle}>{t("role.sunlightTitle")}</Text>
            <Text style={styles.sunlightText}>{t("role.sunlightText")}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },

  trustPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  trustText: { ...type.labelMd, color: colors.text },

  header: { gap: spacing.xs, marginBottom: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brand: { ...type.headlineXlMobile, color: colors.text, flex: 1 },
  tagline: { ...type.bodyXl, color: colors.muted },

  languages: { gap: spacing.sm, marginBottom: spacing.lg },
  languageHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  languageLabel: { ...type.labelLg, color: colors.text },
  languageGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  languageChip: {
    ...elevation.level1,
    // Three to a row on a phone, each still a large tap target.
    flexBasis: "30%",
    flexGrow: 1,
    minHeight: 64,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  languageChipOn: {
    backgroundColor: colors.patient,
    borderColor: colors.patient,
  },
  languageNative: { ...type.headlineMd, color: colors.text, textAlign: "center" },
  languageEnglish: { ...type.labelMd, color: colors.muted, textAlign: "center" },
  languageTextOn: { color: colors.onPatient },

  // The mockup's photo is a temporary Stitch asset URL, so the banner keeps the
  // layout and copy on the tint the gradient resolves to behind the text.
  banner: {
    backgroundColor: colors.patientTint,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.lg,
    minHeight: 96,
    justifyContent: "center",
  },
  bannerLabel: {
    ...type.labelMd,
    color: colors.onPrimaryFixed,
    letterSpacing: 0.8,
  },
  bannerText: { ...type.bodyMd, color: colors.onPrimaryFixed },

  roles: { gap: spacing.md },
  roleCard: {
    ...elevation.level1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 148,
    justifyContent: "center",
  },
  pressed: { opacity: 0.88 },
  roleTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  roleTile: {
    width: 56,
    height: 56,
    borderRadius: radius.tile,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTitle: { ...type.headlineMd, flex: 1 },
  roleArrow: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  roleDescription: { ...type.bodyMd, color: colors.muted },
  roleFootnote: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  roleFootnoteText: { ...type.labelMd, flex: 1 },

  sunlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  sunlightBody: { flex: 1, gap: 2 },
  sunlightTitle: { ...type.labelMd, color: colors.text },
  // Wraps rather than truncating: Tamil and Malayalam run much longer.
  sunlightText: { ...type.labelMd, color: colors.muted },
});
