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
import { useDoctorSession } from "@/lib/doctor-session";
import { colors, spacing } from "@/lib/theme";

const SPECIALIZATIONS = [
  "General Medicine",
  "Obstetrics & Gynaecology",
  "Paediatrics",
  "Community Medicine",
  "Surgery",
  "Other",
] as const;

/**
 * Doctor identity capture. This is not a login - it records who is using the
 * app so consultation notes can be attributed.
 */
export default function DoctorIdentity() {
  const router = useRouter();
  const { setDoctor } = useDoctorSession();

  const [name, setName] = useState("");
  const [specialization, setSpecialization] = useState<string | null>(
    "General Medicine",
  );
  const [customSpecialization, setCustomSpecialization] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolved =
    specialization === "Other" ? customSpecialization.trim() : specialization ?? "";

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!resolved) {
      setError("Please enter your specialization.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const doctor = await api.createDoctor({
        name: name.trim(),
        specialization: resolved,
      });
      setDoctor(doctor);
      router.replace("/doctor/queue");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.heading}>Who is on duty?</Text>
        <Text style={styles.body}>
          No password in this build - this just tags the notes you write. The
          session ends when you close the app.
        </Text>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.form}>
        <TextField
          label="Your name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Anita Sharma"
          autoCapitalize="words"
        />
        <ChoiceChips
          label="Specialization"
          options={SPECIALIZATIONS}
          value={specialization}
          onChange={setSpecialization}
          tone="doctor"
        />
        {specialization === "Other" ? (
          <TextField
            label="Specialization"
            value={customSpecialization}
            onChangeText={setCustomSpecialization}
            placeholder="Enter your specialization"
            autoCapitalize="words"
          />
        ) : null}
      </View>

      <Button
        title="Start session"
        onPress={handleSubmit}
        loading={submitting}
        tone="doctor"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: "700", color: colors.text },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  form: { gap: spacing.lg },
});
