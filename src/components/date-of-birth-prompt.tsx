import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { DateOfBirthField } from "@/components/past-date-field";
import { Button, ErrorBanner } from "@/components/ui";
import { api, Patient } from "@/lib/api";
import { colors, radius, spacing, type } from "@/lib/theme";

/**
 * Asks a patient registered before date of birth was collected to add it.
 *
 * A card on Home, not a blocking modal: skipping must never stop someone using
 * the app. The parent decides when to show it (once, until skipped).
 */
export function DateOfBirthPrompt({
  uniqueCode,
  onSaved,
  onSkip,
}: {
  uniqueCode: string;
  onSaved: (patient: Patient) => void;
  onSkip: () => void;
}) {
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!dateOfBirth) return;
    setError(null);
    setSaving(true);
    try {
      onSaved(await api.updatePatient(uniqueCode, { date_of_birth: dateOfBirth }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your date of birth.");
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Icon name="cake" size={26} color={colors.patient} />
        </View>
        <View style={styles.headBody}>
          <Text style={styles.title}>Add your date of birth</Text>
          <Text style={styles.body}>
            It lets your doctor see your age at every past visit. It takes a few
            seconds.
          </Text>
        </View>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <DateOfBirthField value={dateOfBirth} onChange={setDateOfBirth} />

      <Button
        title="Save date of birth"
        icon="check"
        onPress={save}
        loading={saving}
        disabled={!dateOfBirth}
        tone="patient"
      />
      <Pressable
        accessibilityRole="button"
        onPress={onSkip}
        style={styles.skip}
        hitSlop={12}
      >
        <Text style={styles.skipText}>Skip for now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.patient,
    padding: spacing.md,
    gap: spacing.md,
  },
  head: { flexDirection: "row", gap: spacing.sm },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.patientTint,
    alignItems: "center",
    justifyContent: "center",
  },
  headBody: { flex: 1, gap: 2 },
  title: { ...type.headlineMd, color: colors.text },
  body: { ...type.bodyMd, color: colors.muted },
  skip: { alignItems: "center", paddingVertical: spacing.xs },
  skipText: { ...type.labelLg, color: colors.muted },
});
