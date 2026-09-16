import * as Clipboard from "expo-clipboard";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DateOfBirthPrompt } from "@/components/date-of-birth-prompt";
import { Icon } from "@/components/icon";
import { LanguagePicker } from "@/components/language-picker";
import { Button, Card, ErrorBanner, ListRow, Screen, SectionTitle } from "@/components/ui";
import { api, PatientRecord } from "@/lib/api";
import { ageLong, genderLabel, languageLabel } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { usePatientSession } from "@/lib/patient-session";
import { colors, radius, spacing, touch, type } from "@/lib/theme";

function Detail({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Icon name={icon} size={24} color={colors.patient} />
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

/** The patient's MedLink ID, details, language, and signing out. */
export default function PatientProfile() {
  const router = useRouter();
  const { t } = useT();
  const { session, switchProfile, signOut } = usePatientSession();

  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addingDob, setAddingDob] = useState(false);

  const code = session?.unique_code ?? "";

  const load = useCallback(async () => {
    if (!code) return;
    try {
      setRecord(await api.getPatientRecord(code));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("home.loadFailed"));
    }
  }, [code, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function copyCode() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function onSwitch() {
    await switchProfile();
    router.replace("/patient");
  }

  async function onSignOut() {
    await signOut();
    router.replace("/patient");
  }

  return (
    <Screen>
      {/* The ID a doctor uses to find this patient */}
      <View style={styles.idCard}>
        <Text style={styles.idLabel}>{t("home.idLabel")}</Text>
        <Text style={styles.idValue} selectable>
          {code}
        </Text>
        <Text style={styles.idHint}>{t("profile.idHint")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={copyCode}
          style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
        >
          <Icon name={copied ? "check" : "content_copy"} size={22} color={colors.patient} />
          <Text style={styles.copyText}>{copied ? t("home.copied") : t("home.copyId")}</Text>
        </Pressable>
      </View>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {record ? (
        <Card style={styles.details}>
          <Detail icon="person" label={t("register.name")} value={record.name} />
          <Detail
            icon="cake"
            label={t("profile.age")}
            value={`${ageLong(record.age_label)} · ${genderLabel(record.gender)}`}
          />
          <Detail icon="smartphone" label={t("signIn.phoneLabel")} value={`+91 ${record.phone}`} />
          <Detail icon="home" label={t("register.village")} value={record.village} />
          <Detail
            icon="record_voice_over"
            label={t("register.language")}
            value={languageLabel(record.preferred_language)}
          />
        </Card>
      ) : null}

      {record && record.date_of_birth === null ? (
        addingDob ? (
          <DateOfBirthPrompt
            uniqueCode={record.unique_code}
            onSaved={() => {
              setAddingDob(false);
              load();
            }}
            onSkip={() => setAddingDob(false)}
          />
        ) : (
          <ListRow
            icon="cake"
            title={t("dob.title")}
            onPress={() => setAddingDob(true)}
          />
        )
      ) : null}

      <SectionTitle>{t("profile.appLanguage")}</SectionTitle>
      <LanguagePicker />

      <SectionTitle>{t("profile.account")}</SectionTitle>
      <ListRow
        icon="groups"
        title={t("profile.switchMember")}
        subtitle={t("profile.switchMemberHint")}
        onPress={onSwitch}
      />
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
  pressed: { opacity: 0.88 },

  idCard: {
    backgroundColor: colors.patientSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  idLabel: { ...type.labelLg, color: colors.patient },
  idValue: { ...type.headlineXl, color: colors.text, letterSpacing: 2 },
  idHint: { ...type.bodyLg, fontSize: 16, lineHeight: 24, color: colors.muted, textAlign: "center" },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touch.min,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
  },
  copyText: { ...type.labelLg, color: colors.patient },

  details: { gap: spacing.md },
  detail: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  detailBody: { flex: 1, minWidth: 0 },
  detailLabel: { ...type.labelMd, fontFamily: type.bodyLg.fontFamily, color: colors.muted },
  detailValue: { ...type.labelLg, color: colors.text },

  signOut: { marginTop: spacing.xs },
});
