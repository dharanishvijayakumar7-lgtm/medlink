import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { Button, Card, ErrorBanner, Screen, TextField } from "@/components/ui";
import { api, SignInLookup } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { colors, radius, spacing, type } from "@/lib/theme";

/**
 * Mobile number sign-in, shared by the patient and doctor stacks. It looks the
 * number up and hands the result to the screen, which decides where to go.
 * There is no OTP yet: the number says who is using the app, nothing more.
 */
export function PhoneSignIn({
  tone,
  title,
  body,
  onResult,
}: {
  tone: "patient" | "doctor";
  title: string;
  body: string;
  /** Return a message to show it, or null once the screen has moved on. */
  onResult: (result: SignInLookup) => string | null | Promise<string | null>;
}) {
  const { t } = useT();
  const [phone, setPhone] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accent = tone === "doctor" ? colors.doctor : colors.patient;
  const tint = tone === "doctor" ? colors.doctorTint : colors.patientTint;

  async function handleSubmit() {
    // "+91 98765 43210" and "098765 43210" both come down to the last 10 digits.
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError(t("register.errorPhone"));
      return;
    }

    setError(null);
    setChecking(true);
    try {
      setError(await onResult(await api.lookupPhone(digits)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.somethingWrong"));
    } finally {
      setChecking(false);
    }
  }

  return (
    <Screen>
      <Card>
        <View style={styles.introRow}>
          <View style={[styles.introIcon, { backgroundColor: tint }]}>
            <Icon name="smartphone" size={28} color={accent} />
          </View>
          <View style={styles.introBody}>
            <Text style={styles.introTitle}>{title}</Text>
            <Text style={styles.introText}>{body}</Text>
          </View>
        </View>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      <Card style={styles.formCard}>
        <TextField
          label={t("register.phone")}
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            setError(null);
          }}
          onSubmitEditing={handleSubmit}
          placeholder={t("register.phonePlaceholder")}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={15}
          autoFocus
        />
      </Card>

      <Button
        title={t("signIn.continue")}
        icon="login"
        onPress={handleSubmit}
        loading={checking}
        tone={tone}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  introRow: { flexDirection: "row", gap: spacing.sm },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  introBody: { flex: 1, gap: spacing.xs },
  introTitle: { ...type.headlineMd, color: colors.text },
  introText: { ...type.bodyMd, color: colors.muted },

  formCard: { gap: spacing.md },
});
