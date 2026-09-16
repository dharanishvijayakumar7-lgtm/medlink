import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FacilityPicker } from "@/components/facility-picker";
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
import { api, Facility } from "@/lib/api";
import { useDoctorSession } from "@/lib/doctor-session";
import { TranslationKey, useT } from "@/lib/i18n";
import { colors, radius, spacing, type } from "@/lib/theme";

/** Saved in English; the chips show a translated label. */
const SPECIALIZATIONS: Record<string, TranslationKey> = {
  "General Medicine": "doctorSignIn.specGeneral",
  "Obstetrics & Gynaecology": "doctorSignIn.specObgyn",
  Paediatrics: "doctorSignIn.specPaeds",
  "Community Medicine": "doctorSignIn.specCommunity",
  Surgery: "doctorSignIn.specSurgery",
  Other: "gender.other",
};

/** First sign-in on a new number: who the doctor is and where they work. */
export default function DoctorSetup() {
  const router = useRouter();
  const { signIn } = useDoctorSession();
  const { t } = useT();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [name, setName] = useState("");
  const [specialization, setSpecialization] = useState<string | null>(
    "General Medicine",
  );
  const [customSpecialization, setCustomSpecialization] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFacilities = useCallback(async () => {
    try {
      setFacilities(await api.getFacilities());
    } catch {
      // Not fatal: a doctor can start without picking a facility.
      setFacilities([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFacilities();
    }, [loadFacilities]),
  );

  if (!phone) return <Redirect href="/doctor/sign-in" />;

  const resolved =
    specialization === "Other" ? customSpecialization.trim() : specialization ?? "";

  async function handleSubmit() {
    if (!name.trim()) {
      setError(t("doctorSignIn.errorName"));
      return;
    }
    if (!resolved) {
      setError(t("doctorSignIn.errorSpec"));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const doctor = await api.createDoctor({
        name: name.trim(),
        specialization: resolved,
        phone: phone!,
        facility_id: facilityId,
      });
      await signIn(doctor, phone!);
      router.replace("/doctor");
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
            title={t("doctorSignIn.start")}
            icon="check"
            onPress={handleSubmit}
            loading={submitting}
            tone="doctor"
          />
        </>
      }
    >
      <Text style={styles.intro}>{t("doctorSignIn.body")}</Text>

      <View style={styles.phoneRow}>
        <Icon name="smartphone" size={24} color={colors.doctor} />
        <View style={styles.phoneBody}>
          <Text style={styles.phoneLabel}>{t("signIn.phoneLabel")}</Text>
          <Text style={styles.phoneValue}>+91 {phone}</Text>
        </View>
        <LinkButton
          title={t("register.changeNumber")}
          tone="doctor"
          onPress={() => router.replace("/doctor/sign-in")}
        />
      </View>

      <Card style={styles.formCard}>
        <TextField
          label={t("doctorSignIn.name")}
          value={name}
          onChangeText={setName}
          placeholder={t("doctorSignIn.namePlaceholder")}
          autoCapitalize="words"
        />
        <ChoiceChips
          label={t("doctorSignIn.specialization")}
          options={Object.keys(SPECIALIZATIONS)}
          value={specialization}
          onChange={setSpecialization}
          tone="doctor"
          optionLabel={(option) => t(SPECIALIZATIONS[option] ?? option)}
        />
        {specialization === "Other" ? (
          <TextField
            label={t("doctorSignIn.specialization")}
            value={customSpecialization}
            onChangeText={setCustomSpecialization}
            placeholder={t("doctorSignIn.specPlaceholder")}
            autoCapitalize="words"
          />
        ) : null}
        <FacilityPicker
          label={t("doctorSignIn.facility")}
          facilities={facilities}
          selectedId={facilityId}
          onSelect={setFacilityId}
          emptyLabel={t("doctorSignIn.noFacility")}
          hint={t("doctorSignIn.facilityHint")}
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
    backgroundColor: colors.doctorSoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  phoneBody: { flex: 1, minWidth: 0 },
  phoneLabel: { ...type.labelMd, fontFamily: type.bodyLg.fontFamily, color: colors.muted },
  phoneValue: { ...type.headlineMd, color: colors.text },

  formCard: { gap: spacing.lg },
});
