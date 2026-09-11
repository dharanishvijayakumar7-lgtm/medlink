import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, shadow, spacing } from "@/lib/theme";

type RoleCardProps = {
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
};

function RoleCard({ title, subtitle, color, onPress }: RoleCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        { backgroundColor: color },
        pressed && styles.rolePressed,
      ]}
    >
      <Text style={styles.roleTitle}>{title}</Text>
      <Text style={styles.roleSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

/** First screen on launch: choose a role. No fields, no accounts. */
export default function RoleSelect() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>MedLink</Text>
          <Text style={styles.tagline}>
            Voice-first healthcare triage for rural India
          </Text>
        </View>

        <View style={styles.roles}>
          <RoleCard
            title="Continue as Patient"
            subtitle="Check your symptoms, keep your health record and find care nearby"
            color={colors.patient}
            onPress={() => router.push("/patient")}
          />
          <RoleCard
            title="Continue as Doctor"
            subtitle="Review the triage queue, flag high-risk cases and add notes"
            color={colors.doctor}
            onPress={() => router.push("/doctor")}
          />
        </View>

        <Text style={styles.footer}>
          Emergency? Call 112. MedLink does not replace emergency services.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  header: { paddingTop: spacing.xxl, gap: spacing.sm },
  brand: {
    fontSize: 44,
    fontWeight: "800",
    color: colors.patientDark,
    letterSpacing: -1,
  },
  tagline: { fontSize: 16, color: colors.muted, lineHeight: 23 },

  roles: { gap: spacing.lg },
  roleCard: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    minHeight: 150,
    justifyContent: "center",
    gap: spacing.sm,
    ...shadow,
  },
  rolePressed: { opacity: 0.88 },
  roleTitle: { fontSize: 24, fontWeight: "800", color: "#FFFFFF" },
  roleSubtitle: { fontSize: 15, color: "rgba(255,255,255,0.88)", lineHeight: 21 },

  footer: {
    fontSize: 13,
    color: colors.faint,
    textAlign: "center",
    paddingBottom: spacing.sm,
  },
});
