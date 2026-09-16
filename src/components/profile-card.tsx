import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";

/** A person, as a large tappable card with their initial. */
export function ProfileCard({
  name,
  detail,
  onPress,
  accessibilityHint,
}: {
  name: string;
  detail?: string | null;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <Text style={styles.initial}>{initial}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      <Icon name="chevron_right" size={30} color={colors.patient} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...elevation.level1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 96,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  pressed: { backgroundColor: colors.surfaceContainerLow },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.patient,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { ...type.headlineLg, color: colors.onPatient },
  body: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.headlineMd, color: colors.text },
  detail: { ...type.bodyLg, fontSize: 16, lineHeight: 24, color: colors.muted },
});
