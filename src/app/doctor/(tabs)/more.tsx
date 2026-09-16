import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { LanguagePicker } from "@/components/language-picker";
import { Button, IconCircle, ListRow, Screen, SectionTitle } from "@/components/ui";
import { useDoctorSession } from "@/lib/doctor-session";
import { useT } from "@/lib/i18n";
import { colors, radius, spacing, type } from "@/lib/theme";

/** The doctor's profile, facility tools, language and sign out. */
export default function DoctorMore() {
  const router = useRouter();
  const { t } = useT();
  const { doctor, signOut } = useDoctorSession();

  async function onSignOut() {
    await signOut();
    router.replace("/doctor");
  }

  return (
    <Screen>
      {doctor ? (
        <View style={styles.profile}>
          <IconCircle icon="stethoscope" tone="doctor" size={64} solid />
          <View style={styles.profileBody}>
            <Text style={styles.name}>{t("common.doctorName", { name: doctor.name })}</Text>
            <Text style={styles.meta}>{doctor.specialization}</Text>
            {doctor.phone ? <Text style={styles.meta}>+91 {doctor.phone}</Text> : null}
          </View>
        </View>
      ) : null}

      <SectionTitle>{t("more.facility")}</SectionTitle>
      <ListRow
        icon="inventory_2"
        tone="doctor"
        title={t("nav.doctor.stock")}
        subtitle={doctor?.facility?.name ?? t("more.noFacility")}
        onPress={() => router.push("/doctor/stock")}
      />
      <ListRow
        icon="monitoring"
        tone="doctor"
        title={t("nav.doctor.dashboard")}
        subtitle={t("more.dashboardHint")}
        onPress={() => router.push("/doctor/dashboard")}
      />

      <SectionTitle>{t("profile.appLanguage")}</SectionTitle>
      <LanguagePicker tone="doctor" />

      <Button
        title={t("profile.signOut")}
        icon="logout"
        variant="outline"
        tone="neutral"
        onPress={onSignOut}
        style={styles.signOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.doctorSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  profileBody: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.headlineMd, color: colors.text },
  meta: { ...type.bodyLg, fontSize: 16, lineHeight: 24, color: colors.muted },
  signOut: { marginTop: spacing.md },
});
