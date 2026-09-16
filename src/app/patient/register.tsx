import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DateOfBirthField } from "@/components/past-date-field";
import { Icon } from "@/components/icon";
import {
  Button,
  Card,
  ChoiceChips,
  ErrorBanner,
  Screen,
  TextField,
} from "@/components/ui";
import { api } from "@/lib/api";
import { genderLabel, languageLabel } from "@/lib/format";
import { languageInfo, useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { colors, radius, spacing, touch, type } from "@/lib/theme";

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

export default function PatientRegister() {
  const router = useRouter();
  const { identify } = usePatientSession();
  const { t, language: appLanguage } = useT();

  const [name, setName] = useState("");
  // ISO YYYY-MM-DD. Replaces the old typed age: the server derives age from it.
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  // Starts on the language picked on the first screen.
  const [language, setLanguage] = useState<string | null>(
    languageInfo(appLanguage).english,
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return t("register.errorName");
    if (!dateOfBirth) return t("register.errorDob");
    if (!gender) return t("register.errorGender");
    if (phone.replace(/\D/g, "").length < 10) {
      return t("register.errorPhone");
    }
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
      const digits = phone.replace(/\D/g, "");
      const patient = await api.createPatient({
        name: name.trim(),
        date_of_birth: dateOfBirth!,
        gender: gender!,
        phone: digits,
        village: village.trim(),
        preferred_language: language!,
      });
      await identify({ unique_code: patient.unique_code, phone: digits });
      router.replace("/patient/home");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.sectionLabel}>{t("register.section")}</Text>

      <Card>
        <View style={styles.introRow}>
          <View style={styles.introIcon}>
            <Icon name="badge" size={28} color={colors.patient} />
          </View>
          <View style={styles.introBody}>
            <Text style={styles.introTitle}>{t("register.introTitle")}</Text>
            <Text style={styles.introText}>{t("register.introText")}</Text>
          </View>
        </View>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      <Card style={styles.formCard}>
        <TextField
          label={t("register.name")}
          requirement={t("common.required")}
          value={name}
          onChangeText={setName}
          placeholder={t("register.namePlaceholder")}
          autoCapitalize="words"
        />
        <DateOfBirthField
          value={dateOfBirth}
          onChange={setDateOfBirth}
          requirement={t("common.required")}
        />

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
                    size={22}
                    color={selected ? colors.onPatient : colors.muted}
                  />
                  <Text
                    style={[styles.genderText, selected && styles.genderTextOn]}
                  >
                    {genderLabel(option.value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextField
          label={t("register.phone")}
          requirement={t("common.required")}
          value={phone}
          onChangeText={setPhone}
          placeholder={t("register.phonePlaceholder")}
          keyboardType="phone-pad"
          maxLength={15}
          hint={t("register.phoneHint")}
        />
        <TextField
          label={t("register.village")}
          requirement={t("common.required")}
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

      <Button
        title={t("register.submit")}
        icon="badge"
        onPress={handleSubmit}
        loading={submitting}
        tone="patient"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...type.labelMd, color: colors.patient, letterSpacing: 0.8 },

  introRow: { flexDirection: "row", gap: spacing.sm },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.patientTint,
    alignItems: "center",
    justifyContent: "center",
  },
  introBody: { flex: 1, gap: spacing.xs },
  introTitle: { ...type.headlineMd, color: colors.text },
  introText: { ...type.bodyMd, color: colors.muted },

  formCard: { gap: spacing.md },
  field: { gap: spacing.xs },
  label: { ...type.labelLg, color: colors.text },

  genderRow: { flexDirection: "row", gap: spacing.xs },
  genderTile: {
    flex: 1,
    minHeight: touch.patientAction,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  genderTileOn: { backgroundColor: colors.patient },
  genderText: { ...type.labelMd, color: colors.muted },
  genderTextOn: { color: colors.onPatient },
});
