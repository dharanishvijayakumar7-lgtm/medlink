/** Small shared UI kit: plain React Native, no component library. */

import { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import { colors, radius, shadow, spacing } from "@/lib/theme";

export type Tone = "patient" | "doctor" | "danger" | "success" | "warning" | "neutral";

const TONES: Record<Tone, { base: string; tint: string }> = {
  patient: { base: colors.patient, tint: colors.patientTint },
  doctor: { base: colors.doctor, tint: colors.doctorTint },
  danger: { base: colors.danger, tint: colors.dangerTint },
  success: { base: colors.success, tint: colors.successTint },
  warning: { base: colors.warning, tint: colors.warningTint },
  neutral: { base: colors.muted, tint: colors.bg },
};

// --- Layout ------------------------------------------------------------------

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
}: ScreenProps) {
  if (!scroll) {
    return (
      <View style={[styles.screen, styles.screenPadding, contentStyle]}>
        {children}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenPadding, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

// --- Buttons -----------------------------------------------------------------

type ButtonProps = {
  title: string;
  onPress: () => void;
  tone?: Tone;
  variant?: "solid" | "outline";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  tone = "patient",
  variant = "solid",
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const { base } = TONES[tone];
  const inactive = disabled || loading;
  const solid = variant === "solid";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        solid
          ? { backgroundColor: base }
          : { backgroundColor: "transparent", borderWidth: 1.5, borderColor: base },
        pressed && !inactive && styles.buttonPressed,
        inactive && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={solid ? "#FFFFFF" : base} />
      ) : (
        <Text style={[styles.buttonText, { color: solid ? "#FFFFFF" : base }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function LinkButton({
  title,
  onPress,
  tone = "neutral",
}: {
  title: string;
  onPress: () => void;
  tone?: Tone;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text style={[styles.linkButton, { color: TONES[tone].base }]}>{title}</Text>
    </Pressable>
  );
}

// --- Inputs ------------------------------------------------------------------

type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
};

export function TextField({ label, hint, style, ...props }: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        {...props}
        style={[styles.input, props.multiline && styles.inputMultiline, style]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function ChoiceChips({
  label,
  options,
  value,
  onChange,
  tone = "patient",
}: {
  label?: string;
  options: readonly string[];
  value: string | null;
  onChange: (next: string) => void;
  tone?: Tone;
}) {
  const { base, tint } = TONES[tone];
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chipRow}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              style={[
                styles.chip,
                selected && { backgroundColor: tint, borderColor: base },
              ]}
            >
              <Text
                style={[styles.chipText, selected && { color: base, fontWeight: "700" }]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MultiChoiceChips({
  label,
  options,
  values,
  onChange,
  tone = "patient",
}: {
  label?: string;
  options: readonly string[];
  values: string[];
  onChange: (next: string[]) => void;
  tone?: Tone;
}) {
  const { base, tint } = TONES[tone];
  const toggle = (option: string) =>
    onChange(
      values.includes(option)
        ? values.filter((value) => value !== option)
        : [...values, option],
    );

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chipRow}>
        {options.map((option) => {
          const selected = values.includes(option);
          return (
            <Pressable
              key={option}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggle(option)}
              style={[
                styles.chip,
                selected && { backgroundColor: tint, borderColor: base },
              ]}
            >
              <Text
                style={[styles.chipText, selected && { color: base, fontWeight: "700" }]}
              >
                {selected ? "✓ " + option : option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Checkbox({
  label,
  value,
  onValueChange,
  tone = "doctor",
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  tone?: Tone;
}) {
  const { base } = TONES[tone];
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={styles.checkboxRow}
    >
      <View
        style={[styles.checkboxBox, value && { backgroundColor: base, borderColor: base }]}
      >
        {value ? <Text style={styles.checkboxTick}>{"✓"}</Text> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

// --- Status ------------------------------------------------------------------

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const { base, tint } = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: tint }]}>
      <Text style={[styles.badgeText, { color: base }]}>{label}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.patient} />
      {label ? <Text style={styles.centeredText}>{label}</Text> : null}
    </View>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <View style={styles.errorAction}>
          <LinkButton title="Try again" onPress={onRetry} tone="danger" />
        </View>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenPadding: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.faint,
    marginTop: spacing.sm,
  },

  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  linkButton: { fontSize: 15, fontWeight: "600", paddingVertical: spacing.xs },

  field: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  hint: { fontSize: 12, color: colors.muted },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 48,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: "top" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipText: { fontSize: 14, color: colors.muted },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxTick: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  checkboxLabel: { flex: 1, fontSize: 15, color: colors.text, fontWeight: "500" },

  badge: {
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  centeredText: { color: colors.muted, fontSize: 14 },

  errorBanner: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#F3C9C9",
    padding: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "500" },
  errorAction: { marginTop: spacing.xs },

  empty: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
