import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DateOfBirthField } from "@/components/past-date-field";
import { Icon } from "@/components/icon";
import {
  Button,
  Card,
  ChoiceChips,
  ErrorBanner,
  LinkButton,
  Screen,
  TextField,
} from "@/components/ui";
import { api } from "@/lib/api";
import { genderLabel, languageLabel } from "@/lib/format";
import { languageInfo, useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { colors, radius, spacing, type } from "@/lib/theme";

const GENDERS = [
  { value: "Female", icon: "female" },
  { value: "Male", icon: "male" },
  { value: "Other", icon: "person" },
] as const;

/** Saved in English; the chips show each name in the app's language. */
const LANGUAGES = [
  "Hindi",
  "English",
  "Bengali",
  "Marathi",
  "Telugu",
  "Tamil",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Odia",
  "Punjabi",
] as const;

/**
 * A new patient on a number that was just signed in with. The number is
 * fixed here; it may already hold other family members.
 */
export default function PatientRegister() {
  const router = useRouter();
  const { signIn } = usePatientSession();
  const { t, language: appLanguage } = useT();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [name, setName] = useState("");
  // ISO YYYY-MM-DD. The server derives age from it.
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [village, setVillage] = useState("");
  // Starts on the language picked on the first screen.
  const [language, setLanguage] = useState<string | null>(
    languageInfo(appLanguage).english,
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!phone) return <Redirect href="/patient/sign-in" />;

  function validate(): string | null {
    if (!name.trim()) return t("register.errorName");
    if (!dateOfBirth) return t("register.errorDob");
    if (!gender) return t("register.errorGender");
    if (!village.trim()) return t("register.errorVillage");
    if (!language) return t("register.errorLanguage");
    return null;
  }

  async function handleSubmit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const patient = await api.createPatient({
        name: name.trim(),
        date_of_birth: dateOfBirth!,
        gender: gender!,
        phone: phone!,
        village: village.trim(),
        preferred_language: language!,
      });
      await signIn({ unique_code: patient.unique_code, phone: patient.phone });
      router.replace("/patient");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.somethingWrong"));
      setSubmitting(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          {error ? <ErrorBanner message={error} /> : null}
          <Button
            title={t("register.submit")}
            icon="check"
            onPress={handleSubmit}
            loading={submitting}
          />
        </>
      }
    >
      <Text style={styles.intro}>{t("register.introText")}</Text>

      <View style={styles.phoneRow}>
        <Icon name="smartphone" size={24} color={colors.patient} />
        <View style={styles.phoneBody}>
          <Text style={styles.phoneLabel}>{t("signIn.phoneLabel")}</Text>
          <Text style={styles.phoneValue}>+91 {phone}</Text>
        </View>
        <LinkButton
          title={t("register.changeNumber")}
          tone="patient"
          onPress={() => router.replace("/patient/sign-in")}
        />
      </View>

      <Card style={styles.formCard}>
        <TextField
          label={t("register.name")}
          value={name}
          onChangeText={setName}
          placeholder={t("register.namePlaceholder")}
          autoCapitalize="words"
        />
        <DateOfBirthField value={dateOfBirth} onChange={setDateOfBirth} />

        <View style={styles.field}>
          <Text style={styles.label}>{t("register.gender")}</Text>
          <View style={styles.genderRow} accessibilityRole="radiogroup">
            {GENDERS.map((option) => {
              const selected = gender === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setGender(option.value)}
                  style={[styles.genderTile, selected && styles.genderTileOn]}
                >
                  <Icon
                    name={option.icon}
                    size={28}
                    color={selected ? colors.onPatient : colors.patient}
                  />
                  <Text style={[styles.genderText, selected && styles.genderTextOn]}>
                    {genderLabel(option.value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextField
          label={t("register.village")}
          value={village}
          onChangeText={setVillage}
          placeholder={t("register.villagePlaceholder")}
          autoCapitalize="words"
        />
        <ChoiceChips
          label={t("register.language")}
          options={LANGUAGES}
          value={language}
          onChange={setLanguage}
          optionLabel={languageLabel}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { ...type.bodyLg, color: colors.muted },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.patientSoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  phoneBody: { flex: 1, minWidth: 0 },
  phoneLabel: { ...type.labelMd, fontFamily: type.bodyLg.fontFamily, color: colors.muted },
  phoneValue: { ...type.headlineMd, color: colors.text },

  formCard: { gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { ...type.labelLg, color: colors.text },

  genderRow: { flexDirection: "row", gap: spacing.sm },
  genderTile: {
    flex: 1,
    minHeight: 76,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: spacing.sm,
  },
  genderTileOn: { backgroundColor: colors.patient, borderColor: colors.patient },
  genderText: { ...type.labelMd, color: colors.text },
  genderTextOn: { color: colors.onPatient },
});
