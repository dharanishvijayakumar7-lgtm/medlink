import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

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
import { colors, spacing } from "@/lib/theme";

const GENDERS = ["Female", "Male", "Other"] as const;

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
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [language, setLanguage] = useState<string | null>("Hindi");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return "Please enter the patient's name.";
    const parsedAge = Number(age);
    if (!age.trim() || !Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      return "Please enter an age between 0 and 120.";
    }
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
        age: Number(age),
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
      <Card>
        <Text style={styles.heading}>Tell us who you are</Text>
        <Text style={styles.body}>
          MedLink will create a health ID for you. There is no password - your ID
          is how a doctor finds your record.
        </Text>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.form}>
        <TextField
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Sunita Devi"
          autoCapitalize="words"
        />
        <TextField
          label="Age"
          value={age}
          onChangeText={(text) => setAge(text.replace(/\D/g, ""))}
          placeholder="e.g. 34"
          keyboardType="number-pad"
          maxLength={3}
        />
        <ChoiceChips
          label="Gender"
          options={GENDERS}
          value={gender}
          onChange={setGender}
        />
        <TextField
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          placeholder="10-digit mobile number"
          keyboardType="phone-pad"
          maxLength={15}
        />
        <TextField
          label="Village / area"
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
      </View>

      <Button
        title="Create my MedLink ID"
        onPress={handleSubmit}
        loading={submitting}
        tone="patient"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: "700", color: colors.text },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  form: { gap: spacing.lg },
});
