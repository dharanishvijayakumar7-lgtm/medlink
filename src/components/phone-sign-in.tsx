import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Icon } from "@/components/icon";
import { Button, ErrorBanner, IconCircle, Screen } from "@/components/ui";
import { api, SignInLookup } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { colors, radius, spacing, touch, type } from "@/lib/theme";

/**
 * Mobile number entry, shared by patient and doctor sign-in. It looks the
 * number up and hands the result back; the screen decides where to go.
 */
export function PhoneSignIn({
  tone,
  title,
  subtitle,
  initialPhone,
  onResult,
}: {
  tone: "patient" | "doctor";
  title: string;
  subtitle: string;
  initialPhone?: string | null;
  /** Return an error message to show it, or null once handled. */
  onResult: (result: SignInLookup) => string | null | Promise<string | null>;
}) {
  const { t } = useT();
  const [digits, setDigits] = useState(initialPhone ?? "");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const accent = tone === "doctor" ? colors.doctor : colors.patient;

  const valid = /^[6-9]\d{9}$/.test(digits);

  function onChange(text: string) {
    // Pasted numbers often carry +91 or a leading 0; keep the last 10 digits.
    let next = text.replace(/\D/g, "");
    if (next.length > 10) next = next.slice(-10);
    setDigits(next);
    setError(null);
  }

  async function submit() {
    if (!valid) {
      setError(t("signIn.invalid"));
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const result = await api.lookupPhone(digits);
      setError(await onResult(result));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.somethingWrong"));
    } finally {
      setChecking(false);
    }
  }

  return (
    <Screen
      footer={
        <Button
          title={t("signIn.continue")}
          icon="arrow_forward"
          tone={tone}
          onPress={submit}
          loading={checking}
          disabled={digits.length < 10}
        />
      }
    >
      <View style={styles.hero}>
        <IconCircle icon={tone === "doctor" ? "stethoscope" : "smartphone"} tone={tone} size={72} />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("signIn.phoneLabel")}</Text>
        <View
          style={[
            styles.inputRow,
            { borderColor: error ? colors.warning : focused ? accent : colors.inputBorder },
          ]}
        >
          <View style={styles.prefix}>
            <Text style={styles.prefixText}>+91</Text>
          </View>
          <TextInput
            value={digits}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={submit}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            autoFocus
            maxLength={14}
            placeholder="9876543210"
            placeholderTextColor={colors.outlineVariant}
            accessibilityLabel={t("signIn.phoneLabel")}
            style={styles.input}
          />
          {valid ? <Icon name="check_circle" size={28} color={colors.success} /> : null}
        </View>
        <Text style={styles.hint}>{t("signIn.phoneHint")}</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  title: { ...type.headlineXlMobile, color: colors.text, textAlign: "center" },
  subtitle: { ...type.bodyLg, color: colors.muted, textAlign: "center" },

  field: { gap: spacing.sm },
  label: { ...type.labelLg, color: colors.text },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touch.sos,
    borderWidth: 2,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingRight: spacing.md,
    overflow: "hidden",
  },
  prefix: {
    alignSelf: "stretch",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceContainer,
  },
  prefixText: { ...type.headlineMd, color: colors.muted },
  input: {
    flex: 1,
    ...type.headlineLg,
    letterSpacing: 2,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  hint: { ...type.bodyLg, fontSize: 16, lineHeight: 24, color: colors.muted },
});
