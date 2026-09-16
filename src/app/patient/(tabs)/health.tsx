import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { ListRow, Screen } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { spacing } from "@/lib/theme";

/** Everything about the patient's own health, one tap away. */
export default function HealthHub() {
  const router = useRouter();
  const { t } = useT();

  return (
    <Screen>
      <View style={styles.list}>
        <ListRow
          icon="stethoscope"
          title={t("home.symptomTitle")}
          subtitle={t("health.symptomSubtitle")}
          onPress={() => router.push("/patient/symptom-check")}
        />
        <ListRow
          icon="folder_shared"
          title={t("home.recordTitle")}
          subtitle={t("home.recordSubtitle")}
          onPress={() => router.push("/patient/record")}
        />
        <ListRow
          icon="description"
          title={t("home.documentsTitle")}
          subtitle={t("home.documentsSubtitle")}
          onPress={() => router.push("/patient/documents")}
        />
        <ListRow
          icon="phone_in_talk"
          title={t("home.callsTitle")}
          subtitle={t("home.callsSubtitle")}
          onPress={() => router.push("/patient/calls")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
