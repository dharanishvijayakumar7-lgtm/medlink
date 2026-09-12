import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
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

/** First screen on launch: choose a role. No fields, no accounts. */
export default function RoleSelect() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.trustPill}>
          <Icon name="verified_user" size={18} color={colors.patient} />
          <Text style={styles.trustText}>Verified Clinical Network</Text>
        </View>

        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Icon name="health_and_safety" size={32} color={colors.patient} />
            <Text style={styles.brand}>Welcome to MedLink</Text>
          </View>
          <Text style={styles.tagline}>Choose how you are using the app today</Text>
        </View>

        <View style={styles.banner}>
          <Text style={styles.bannerLabel}>SAFE &amp; CONFIDENTIAL</Text>
          <Text style={styles.bannerText}>
            Fast access to diagnosis, telemedicine &amp; local care
          </Text>
        </View>

        <View style={styles.roles} accessibilityRole="radiogroup">
          <RoleCard
            icon="person"
            title="I am a Patient"
            description="Check symptoms, view records, find clinics"
            footnoteIcon="mic"
            footnote="Voice and regional guidance enabled"
            accent={colors.patient}
            tileBackground={colors.patientTint}
            onPress={() => router.push("/patient")}
          />
          <RoleCard
            icon="stethoscope"
            title="I am a Doctor"
            description="View patient queue, triage list & clinical notes"
            footnoteIcon="clinical_notes"
            footnote="Clinical telemetry and rapid EHR access"
            accent={colors.doctor}
            tileBackground={colors.doctorTint}
            onPress={() => router.push("/doctor")}
          />
        </View>

        <View style={styles.sunlight}>
          <Icon name="sunny" size={24} color={colors.faint} />
          <View style={styles.sunlightBody}>
            <Text style={styles.sunlightTitle}>High Outdoor Sunlight Mode Active</Text>
            <Text style={styles.sunlightText} numberOfLines={1}>
              Colors calibrated for glare and low-bandwidth connections
            </Text>
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
  roleFootnoteText: { ...type.labelMd },

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
  sunlightText: { ...type.labelMd, color: colors.muted, fontSize: 14 },
});
