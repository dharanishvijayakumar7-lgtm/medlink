import { useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Icon } from "@/components/icon";
import { Button, ErrorBanner, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { normalisePatientCode } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { colors, elevation, radius, spacing, touch, type } from "@/lib/theme";

export default function SearchPatient() {
  const router = useRouter();
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const code = normalisePatientCode(query);
    if (!/^MED-\d{6}$/.test(code)) {
      setError(t("search.formatError"));
      return;
    }

    // Close the keyboard so the loading state on the button is not hidden.
    Keyboard.dismiss();
    setError(null);
    setSearching(true);
    try {
      // Confirm the patient exists before navigating, so a typo is caught here.
      const record = await api.getPatientRecord(code);
      setQuery("");
      router.push({
        pathname: "/doctor/patient/[code]",
        params: { code: record.unique_code },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("search.failed"));
    } finally {
      setSearching(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.lookupLabel}>{t("search.label")}</Text>

      <View style={[styles.searchBox, focused && styles.searchBoxFocused]}>
        <Icon name="search" size={28} color={colors.doctor} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t("search.placeholder")}
          placeholderTextColor={colors.faint}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={search}
          style={styles.searchInput}
        />
        {query.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("search.clear")}
            onPress={() => setQuery("")}
            style={styles.clearButton}
          >
            <Icon name="cancel" size={20} color={colors.faint} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.hintRow}>
        <View style={styles.hintLeft}>
          <Icon name="pin" size={16} color={colors.doctor} />
          <Text style={styles.hintText}>
            {t("search.format")} <Text style={styles.hintStrong}>MED-XXXXXX</Text>
          </Text>
        </View>
        <Text style={styles.hintChip}>{t("search.sixDigits")}</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <Button
        title={t("search.open")}
        icon="folder_shared"
        onPress={search}
        loading={searching}
        tone="doctor"
      />

      <View style={styles.helpCard}>
        <View style={styles.helpTop}>
          <Icon name="history" size={20} color={colors.doctor} />
          <Text style={styles.helpTitle}>{t("search.helpTitle")}</Text>
        </View>
        <Text style={styles.helpBody}>{t("search.help1")}</Text>
        <Text style={styles.helpBody}>{t("search.help2")}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lookupLabel: { ...type.labelMd, color: colors.doctor, letterSpacing: 0.8 },

  searchBox: {
    ...elevation.level1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 58,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  searchBoxFocused: { borderColor: colors.doctor, borderWidth: 2 },
  searchInput: {
    flex: 1,
    ...type.headlineMd,
    color: colors.text,
    letterSpacing: 1,
    paddingVertical: spacing.sm,
  },
  clearButton: {
    width: touch.min,
    height: touch.min,
    alignItems: "center",
    justifyContent: "center",
  },

  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  hintLeft: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  hintText: { ...type.labelMd, color: colors.muted },
  hintStrong: { ...type.labelMd, color: colors.text },
  hintChip: {
    ...type.labelMd,
    color: colors.onSecondaryFixed,
    backgroundColor: colors.secondaryFixed,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    overflow: "hidden",
  },

  helpCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  helpTop: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  helpTitle: { ...type.headlineMd, color: colors.text },
  helpBody: { ...type.bodyMd, color: colors.muted },
});
