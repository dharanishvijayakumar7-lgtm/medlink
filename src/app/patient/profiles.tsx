import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ProfileCard } from "@/components/profile-card";
import { Button, ErrorBanner, IconCircle, LinkButton, Loading, Screen } from "@/components/ui";
import { api, PatientChoice } from "@/lib/api";
import { ageShort, genderLabel } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { colors, spacing, type } from "@/lib/theme";

/**
 * "Who is using MedLink?" - every patient registered on this number. A family
 * often shares one phone, so each member picks their own profile.
 */
export default function ChooseProfile() {
  const router = useRouter();
  const { t } = useT();
  const { signIn, signOut } = usePatientSession();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [patients, setPatients] = useState<PatientChoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!phone) return;
    try {
      const result = await api.lookupPhone(phone);
      setPatients(result.role === "doctor" ? [] : result.patients);
      setError(result.role === "doctor" ? t("signIn.numberIsDoctor") : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.somethingWrong"));
    }
  }, [phone, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function choose(patient: PatientChoice) {
    setOpening(patient.unique_code);
    await signIn({ unique_code: patient.unique_code, phone: phone! });
    router.replace("/patient");
  }

  async function useAnotherNumber() {
    await signOut();
    router.replace("/patient/sign-in");
  }

  if (!phone) return null;
  if (patients === null && !error) return <Loading />;

  return (
    <Screen
      refreshing={false}
      onRefresh={load}
      footer={
        <Button
          title={t("profiles.addMember")}
          icon="person_add"
          variant="outline"
          onPress={() => router.push({ pathname: "/patient/register", params: { phone } })}
        />
      }
    >
      <View style={styles.hero}>
        <IconCircle icon="groups" size={72} />
        <Text style={styles.title} accessibilityRole="header">
          {t("profiles.title")}
        </Text>
        <Text style={styles.subtitle}>{t("profiles.subtitle", { phone: `+91 ${phone}` })}</Text>
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      <View style={styles.list}>
        {(patients ?? []).map((patient) => (
          <ProfileCard
            key={patient.unique_code}
            name={patient.name}
            detail={[patient.age_label && ageShort(patient.age_label), genderLabel(patient.gender)]
              .filter(Boolean)
              .join(" · ")}
            onPress={() => (opening ? undefined : choose(patient))}
          />
        ))}
      </View>

      <View style={styles.switch}>
        <LinkButton title={t("profiles.otherNumber")} tone="patient" onPress={useAnotherNumber} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  title: { ...type.headlineXlMobile, color: colors.text, textAlign: "center" },
  subtitle: { ...type.bodyLg, color: colors.muted, textAlign: "center" },
  list: { gap: spacing.md },
  switch: { alignItems: "center", paddingTop: spacing.sm },
});
