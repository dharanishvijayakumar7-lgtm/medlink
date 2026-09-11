import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { Button, Card, ErrorBanner, Screen, TextField } from "@/components/ui";
import { api } from "@/lib/api";
import { normalisePatientCode } from "@/lib/format";
import { colors } from "@/lib/theme";

export default function SearchPatient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const code = normalisePatientCode(query);
    if (!/^MED-\d{6}$/.test(code)) {
      setError("Enter a MedLink ID in the form MED-482119.");
      return;
    }

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
      setError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Text style={styles.heading}>Open a patient record</Text>
        <Text style={styles.body}>
          Ask the patient for their MedLink ID. Typing the six digits alone works
          too.
        </Text>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      <TextField
        label="Patient ID"
        value={query}
        onChangeText={setQuery}
        placeholder="MED-482119"
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={search}
        style={styles.input}
      />

      <Button
        title="Open record"
        onPress={search}
        loading={searching}
        tone="doctor"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: "700", color: colors.text },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  input: { fontSize: 22, fontWeight: "700", letterSpacing: 2, minHeight: 60 },
});
