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
import { usePatientSession } from "@/lib/patient-session";
import { colors, radius, spacing, touch, type } from "@/lib/theme";

const GENDERS = [
  { value: "Female", icon: "female" },
  { value: "Male", icon: "male" },
  { value: "Other", icon: "person" },
] as const;

/** Stored as-is for now; translation of the app itself is a later part. */
const LANGUAGES = [
  "Hindi",
  "English",
  "Bengali",
  "Marathi",
  "Telugu",
  "Tamil",
  "Gujarati",
  "Kannada",
  "Odia",
  "Punjabi",
] as const;

export default function PatientRegister() {
  const router = useRouter();
  const { identify } = usePatientSession();

  const [name, setName] = useState("");
  // ISO YYYY-MM-DD. Replaces the old typed age: the server derives age from it.
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [language, setLanguage] = useState<string | null>("Hindi");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return "Please enter the patient's name.";
    if (!dateOfBirth) return "Please choose the patient's date of birth.";
    if (!gender) return "Please select a gender.";
    if (phone.replace(/\D/g, "").length < 10) {
      return "Please enter a 10-digit phone number.";
    }
    if (!village.trim()) return "Please enter your village or area.";
    if (!language) return "Please select a preferred language.";
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
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.sectionLabel}>PATIENT DETAILS</Text>

      <Card>
        <View style={styles.introRow}>
          <View style={styles.introIcon}>
            <Icon name="badge" size={28} color={colors.patient} />
          </View>
          <View style={styles.introBody}>
            <Text style={styles.introTitle}>Basic Information</Text>
            <Text style={styles.introText}>
              Tap any box to fill in the patient&apos;s information. There is no
              password - your MedLink ID is how a doctor finds you.
            </Text>
          </View>
        </View>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      <Card style={styles.formCard}>
        <TextField
          label="Full Name"
          requirement="Required"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Sunita Devi"
          autoCapitalize="words"
        />
        <DateOfBirthField
          value={dateOfBirth}
          onChange={setDateOfBirth}
          requirement="Required"
        />

        <View style={styles.field}>
          <Text style={styles.label}>Gender</Text>
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
                    {option.value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextField
          label="Phone number"
          requirement="Required"
          value={phone}
          onChangeText={setPhone}
          placeholder="10-digit mobile number"
          keyboardType="phone-pad"
          maxLength={15}
          hint="The voice agent matches callers by this number."
        />
        <TextField
          label="Village / area"
          requirement="Required"
          value={village}
          onChangeText={setVillage}
          placeholder="e.g. Ramnagar, Chandauli"
          autoCapitalize="words"
        />
        <ChoiceChips
          label="Preferred language"
          options={LANGUAGES}
          value={language}
          onChange={setLanguage}
        />
      </Card>

      <Button
        title="Create my MedLink ID"
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
