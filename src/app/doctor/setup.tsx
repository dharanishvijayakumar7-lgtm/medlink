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

const ASSURANCES: { icon: string; title: TranslationKey; caption: TranslationKey }[] = [
  { icon: "lock", title: "doctorSignIn.ehrTitle", caption: "doctorSignIn.ehrCaption" },
  { icon: "sync_alt", title: "doctorSignIn.syncTitle", caption: "doctorSignIn.syncCaption" },
];

/**
 * Doctor details, asked once: the first time a new mobile number signs in
 * (see ./index). The profile is saved against that number.
 */
export default function DoctorIdentity() {
  const router = useRouter();
  const { setDoctor } = useDoctorSession();
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
      // Not fatal: a doctor can start a session without picking a facility.
      setFacilities([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFacilities();
    }, [loadFacilities]),
  );

  if (!phone) return <Redirect href="/doctor" />;

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
      setDoctor(doctor);
      router.replace("/doctor/queue");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Card>
        <View style={styles.topRow}>
          <View style={styles.verifiedPill}>
            <Icon name="verified_user" size={16} color={colors.onSecondaryContainer} />
            <Text style={styles.verifiedText}>{t("role.trust")}</Text>
          </View>
          <Text style={styles.stepText}>{t("doctorSignIn.step")}</Text>
        </View>

        <Text style={styles.title}>{t("doctorSignIn.title")}</Text>
        <Text style={styles.body}>{t("doctorSignIn.body")}</Text>

        <View style={styles.assuranceGrid}>
          {ASSURANCES.map((item) => (
            <View key={item.title} style={styles.assurance}>
              <View style={styles.assuranceIcon}>
                <Icon name={item.icon} size={18} color={colors.onDoctor} />
              </View>
              <View style={styles.assuranceBody}>
                <Text style={styles.assuranceTitle} numberOfLines={2}>
                  {t(item.title)}
                </Text>
                <Text style={styles.assuranceCaption} numberOfLines={2}>
                  {t(item.caption)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      <Card style={styles.formCard}>
        <TextField
          label={t("doctorSignIn.name")}
          labelIcon="badge"
          value={name}
          onChangeText={setName}
          placeholder={t("doctorSignIn.namePlaceholder")}
          autoCapitalize="words"
          hint={t("doctorSignIn.nameHint")}
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
            labelIcon="clinical_notes"
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

      <Button
        title={t("doctorSignIn.start")}
        icon="login"
        onPress={handleSubmit}
        loading={submitting}
        tone="doctor"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.secondaryContainer,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  verifiedText: { ...type.labelMd, color: colors.onSecondaryContainer },
  stepText: { ...type.labelMd, color: colors.faint },

  title: { ...type.headlineMd, color: colors.text, marginTop: spacing.xs },
  body: { ...type.bodyMd, color: colors.muted },

  assuranceGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  assurance: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  assuranceIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.doctor,
    alignItems: "center",
    justifyContent: "center",
  },
  assuranceBody: { flex: 1, minWidth: 0 },
  assuranceTitle: { ...type.labelMd, color: colors.text },
  assuranceCaption: { ...type.labelMd, color: colors.muted },

  formCard: { gap: spacing.md },
});
