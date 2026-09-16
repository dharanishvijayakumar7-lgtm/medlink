/**
 * Shared header and tab bar styling for the patient and doctor stacks, so
 * both look and behave the same and only the accent colour differs.
 */

import { useRouter } from "expo-router";
import { ComponentProps } from "react";
import { ColorValue, Pressable, StyleSheet, Text } from "react-native";

import { Icon } from "@/components/icon";
import { useT } from "@/lib/i18n";
import { colors, radius, spacing, type } from "@/lib/theme";

import type { Stack, Tabs } from "expo-router";

type Role = "patient" | "doctor";

const accentFor = (role: Role) => (role === "doctor" ? colors.doctor : colors.patient);

/** Flat, light header: borders carry depth, never a shadow. */
export function stackScreenOptions(
  role: Role,
): NonNullable<ComponentProps<typeof Stack>["screenOptions"]> {
  return {
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: accentFor(role),
    headerTitleStyle: { ...type.headlineMd, color: colors.text },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.bg },
  };
}

function TabLabel({ label, color }: { label: string; color: ColorValue }) {
  return (
    <Text
      style={[styles.tabLabel, { color }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
    >
      {label}
    </Text>
  );
}

export function tabScreenOptions(
  role: Role,
): NonNullable<ComponentProps<typeof Tabs>["screenOptions"]> {
  const accent = accentFor(role);
  return {
    headerStyle: { backgroundColor: colors.bg },
    headerTitleStyle: { ...type.headlineMd, color: colors.text },
    headerShadowVisible: false,
    sceneStyle: { backgroundColor: colors.bg },
    tabBarActiveTintColor: accent,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: styles.tabBar,
    tabBarItemStyle: styles.tabItem,
    tabBarLabel: ({ color, children }) => <TabLabel label={children} color={color} />,
  };
}

/** A tab icon that sits in a soft pill when its tab is selected. */
export function tabIcon(name: string, role: Role) {
  const soft = role === "doctor" ? colors.doctorSoft : colors.patientSoft;
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <Icon
        name={name}
        size={28}
        color={color as string}
        style={[styles.iconPill, focused && { backgroundColor: soft }]}
      />
    );
  }
  return TabIcon;
}

/**
 * A back arrow for the first screen of a role stack, which has nothing of its
 * own to go back to: it returns to the welcome screen.
 */
export function BackToWelcome({ tint }: { tint: string }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("common.back")}
      hitSlop={12}
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      style={styles.back}
    >
      <Icon name="arrow_back" size={26} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: undefined,
    paddingTop: spacing.sm,
  },
  tabItem: { paddingBottom: spacing.xs, gap: 2 },
  tabLabel: { ...type.labelMd, lineHeight: 20 },
  iconPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  back: { paddingRight: spacing.md, paddingVertical: spacing.xs },
});
