import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { Button, Card, ErrorBanner, Loading, Screen } from "@/components/ui";
import { api, PatientChoice } from "@/lib/api";
import { ageShort, genderLabel } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { colors, elevation, radius, spacing, touch, type } from "@/lib/theme";

/**
 * Every patient registered on the number just signed in with. A family often
 * shares one phone, so each member picks their own profile.
 */
export default function ChooseProfile() {
  const router = useRouter();
  const { t } = useT();
  const { identify } = usePatientSession();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [patients, setPatients] = useState<PatientChoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!phone) return;
    try {
      const result = await api.lookupPhone(phone);
      setPatients(result.patients);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.somethingWrong"));
    }
  }, [phone, t]);

  // Reloads after "Add a family member" returns here.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function choose(patient: PatientChoice) {
    await identify({ unique_code: patient.unique_code, phone: phone! });
    router.replace("/patient/home");
  }

  if (patients === null && !error) return <Loading />;

  return (
    <Screen>
      <Card>
        <View style={styles.introRow}>
          <View style={styles.introIcon}>
            <Icon name="groups" size={28} color={colors.patient} />
          </View>
          <View style={styles.introBody}>
            <Text style={styles.introTitle}>{t("profiles.title")}</Text>
            <Text style={styles.introText}>{t("profiles.body", { phone })}</Text>
          </View>
        </View>
      </Card>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {(patients ?? []).map((patient) => (
        <Pressable
          key={patient.unique_code}
          accessibilityRole="button"
          onPress={() => choose(patient)}
          style={({ pressed }) => [styles.person, pressed && styles.pressed]}
        >
          <View style={styles.personIcon}>
            <Icon name="person" size={28} color={colors.patient} />
          </View>
          <View style={styles.personBody}>
            <Text style={styles.personName} numberOfLines={2}>
              {patient.name}
            </Text>
            <Text style={styles.personMeta}>
              {ageShort(patient.age_label)} · {genderLabel(patient.gender)}
            </Text>
          </View>
          <Icon name="chevron_right" size={24} color={colors.faint} />
        </Pressable>
      ))}

      <Button
        title={t("profiles.addMember")}
        icon="person_add"
        onPress={() => router.push({ pathname: "/patient/register", params: { phone } })}
        tone="patient"
        variant="outline"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9 },

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

  person: {
    ...elevation.level1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: touch.row,
  },
  personIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.tile,
    backgroundColor: colors.patientTint,
    alignItems: "center",
    justifyContent: "center",
  },
  personBody: { flex: 1, minWidth: 0 },
  personName: { ...type.headlineMd, color: colors.text },
  personMeta: { ...type.bodyMd, color: colors.muted },
});
