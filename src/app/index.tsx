import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { LanguagePicker } from "@/components/language-picker";
import { IconCircle } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { colors, radius, spacing, type } from "@/lib/theme";

function RoleCard({
  icon,
  title,
  subtitle,
  tone,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  tone: "patient" | "doctor";
  onPress: () => void;
}) {
  const accent = tone === "doctor" ? colors.doctor : colors.patient;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        { borderColor: accent },
        pressed && styles.pressed,
      ]}
    >
      <IconCircle icon={icon} tone={tone} size={64} solid />
      <View style={styles.roleBody}>
        <Text style={[styles.roleTitle, { color: accent }]}>{title}</Text>
        <Text style={styles.roleSubtitle}>{subtitle}</Text>
      </View>
      <Icon name="arrow_forward" size={30} color={accent} />
    </Pressable>
  );
}

/** First screen on launch: pick a language, then say who you are. */
export default function Welcome() {
  const router = useRouter();
  const { t } = useT();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Icon name="health_and_safety" size={40} color={colors.onPatient} />
          </View>
          <View style={styles.brandBody}>
            <Text style={styles.brand} accessibilityRole="header">
              MedLink
            </Text>
            <Text style={styles.tagline}>{t("role.tagline")}</Text>
          </View>
        </View>

        <LanguagePicker />

        <View style={styles.roles}>
          <Text style={styles.question}>{t("role.question")}</Text>
          <RoleCard
            icon="person"
            title={t("role.patientTitle")}
            subtitle={t("role.patientDescription")}
            tone="patient"
            onPress={() => router.push("/patient")}
          />
          <RoleCard
            icon="stethoscope"
            title={t("role.doctorTitle")}
            subtitle={t("role.doctorDescription")}
            tone="doctor"
            onPress={() => router.push("/doctor")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },

  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.patient,
    alignItems: "center",
    justifyContent: "center",
  },
  brandBody: { flex: 1, minWidth: 0 },
  brand: { ...type.headlineXl, color: colors.text },
  tagline: { ...type.bodyLg, color: colors.muted },

  roles: { gap: spacing.md },
  question: { ...type.headlineMd, color: colors.text },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 112,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  pressed: { backgroundColor: colors.surfaceContainerLow },
  roleBody: { flex: 1, minWidth: 0, gap: 2 },
  roleTitle: { ...type.headlineMd },
  roleSubtitle: { ...type.bodyLg, fontSize: 16, lineHeight: 24, color: colors.muted },
});
