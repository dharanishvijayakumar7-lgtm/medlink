/**
 * Shared UI kit, built on the Rural Clinical Core tokens in @/lib/theme.
 *
 * Every value here comes from a token. Three system rules are enforced by the
 * components rather than left to call sites:
 *  - Red is emergency-only. `warning` (amber) carries every clinical alert,
 *    error state and destructive action.
 *  - Elevation is borders, never a soft drop shadow.
 *  - Pills are for status chips and filter toggles only, never content cards.
 */

import { ReactNode, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { useT } from "@/lib/i18n";
import { colors, elevation, radius, spacing, touch, type } from "@/lib/theme";

export type Tone =
  | "patient"
  | "doctor"
  | "warning"
  | "emergency"
  | "success"
  | "neutral";

const TONES: Record<Tone, { base: string; tint: string; soft: string; on: string }> = {
  patient: {
    base: colors.patient,
    tint: colors.patientTint,
    soft: colors.patientSoft,
    on: colors.onPatient,
  },
  doctor: {
    base: colors.doctor,
    tint: colors.doctorTint,
    soft: colors.doctorSoft,
    on: colors.onDoctor,
  },
  warning: {
    base: colors.warning,
    tint: colors.warningTint,
    soft: colors.warningSoft,
    on: colors.onWarning,
  },
  emergency: {
    base: colors.emergency,
    tint: colors.emergencyTint,
    soft: colors.emergencyTint,
    on: colors.onEmergency,
  },
  success: {
    base: colors.success,
    tint: colors.successTint,
    soft: colors.successSoft,
    on: colors.onSuccess,
  },
  neutral: {
    base: colors.muted,
    tint: colors.surfaceContainerHigh,
    soft: colors.surfaceContainer,
    on: colors.inverseOnSurface,
  },
};

export function toneColor(tone: Tone): string {
  return TONES[tone].base;
}

// --- Layout ------------------------------------------------------------------

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * The screen's main action, pinned to the bottom so it is always in the
   * same place and never scrolls out of reach.
   */
  footer?: ReactNode;
  /** Pad for the status bar, for screens that have no header above them. */
  safeTop?: boolean;
};

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  footer,
  safeTop = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const top = safeTop ? { paddingTop: insets.top + spacing.md } : null;

  const body = scroll ? (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenPadding, top, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screen, styles.screenPadding, top, contentStyle]}>
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {body}
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.sm },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Card({
  children,
  style,
  clinical = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 2px navy border marking an active clinician card. */
  clinical?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        clinical ? elevation.level1Clinical : elevation.level1,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** A coloured circle holding an icon - the app's one icon container. */
export function IconCircle({
  icon,
  tone = "patient",
  size = 52,
  solid = false,
}: {
  icon: string;
  tone?: Tone;
  size?: number;
  /** Filled with the tone colour instead of its soft tint. */
  solid?: boolean;
}) {
  const { base, soft, on } = TONES[tone];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: solid ? base : soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.52)} color={solid ? on : base} />
    </View>
  );
}

/**
 * A tappable row: icon, title, an optional one-line subtitle and a chevron.
 * The standard way to list places to go.
 */
export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  tone = "patient",
  right,
}: {
  icon: string;
  title: string;
  subtitle?: string | null;
  onPress: () => void;
  tone?: Tone;
  /** Replaces the chevron, e.g. with a badge. */
  right?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
    >
      <IconCircle icon={icon} tone={tone} />
      <View style={styles.listRowBody}>
        <Text style={styles.listRowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listRowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? <Icon name="chevron_right" size={28} color={colors.faint} />}
    </Pressable>
  );
}

/** A tile for the two-up grids on home screens. */
export function ActionTile({
  icon,
  title,
  subtitle,
  onPress,
  tone = "patient",
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: Tone;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.rowPressed]}
    >
      <IconCircle icon={icon} tone={tone} size={56} />
      <Text style={styles.tileTitle}>{title}</Text>
      {subtitle ? <Text style={styles.tileSubtitle}>{subtitle}</Text> : null}
    </Pressable>
  );
}

/** One calm line of context. Replaces heavy banners for non-urgent notes. */
export function InfoNote({
  text,
  icon = "info",
  tone = "neutral",
}: {
  text: string;
  icon?: string;
  tone?: Tone;
}) {
  const { base, soft } = TONES[tone];
  return (
    <View style={[styles.infoNote, { backgroundColor: soft }]}>
      <Icon name={icon} size={22} color={base} />
      <Text style={styles.infoNoteText}>{text}</Text>
    </View>
  );
}

/** Screen header: icon beside a headline, as every mockup opens. */
export function ScreenHeader({
  icon,
  title,
  subtitle,
  tone = "patient",
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  tone?: Tone;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {icon ? <Icon name={icon} size={32} color={TONES[tone].base} /> : null}
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// --- Buttons -----------------------------------------------------------------

type ButtonProps = {
  title: string;
  onPress: () => void;
  tone?: Tone;
  variant?: "solid" | "outline";
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Height follows the tone: patient 60, doctor 48, emergency 64. */
function heightFor(tone: Tone): number {
  if (tone === "emergency") return touch.sos;
  if (tone === "doctor") return touch.doctorAction;
  return touch.patientAction;
}

export function Button({
  title,
  onPress,
  tone = "patient",
  variant = "solid",
  icon,
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const { base, on } = TONES[tone];
  const inactive = disabled || loading;
  const solid = variant === "solid";
  const label = solid ? on : base;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { minHeight: heightFor(tone) },
        solid
          ? { backgroundColor: base }
          : { backgroundColor: "transparent", borderWidth: 2, borderColor: base },
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={label} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={24} color={label} /> : null}
          <Text style={[styles.buttonText, { color: label }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * Destructive action. Never red - DESIGN.md reserves red for emergencies, so
 * this is a charcoal outline, or amber when data loss is at stake.
 */
export function DestructiveButton({
  title,
  onPress,
  dataLoss = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  dataLoss?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const line = dataLoss ? colors.warning : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { minHeight: touch.min, borderWidth: 2, borderColor: line },
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={22} color={line} /> : null}
      <Text style={[styles.buttonText, { color: line }]}>{title}</Text>
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
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12}>
      <Text style={[styles.linkButton, { color: TONES[tone].base }]}>{title}</Text>
    </Pressable>
  );
}

// --- Inputs ------------------------------------------------------------------

type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  /** Switches the border to amber and shows the message below. Never red. */
  error?: string | null;
  /** Right-aligned marker on the label row, as the registration mockups show. */
  requirement?: string;
  /** Small glyph before the label, used on the doctor forms. */
  labelIcon?: string;
};

export function TextField({
  label,
  hint,
  error,
  requirement,
  labelIcon,
  style,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.warning
    : focused
      ? colors.patient
      : colors.inputBorder;

  return (
    <View style={styles.field}>
      {/* Pinned above the input, never a placeholder that vanishes on typing. */}
      <View style={styles.labelRow}>
        {labelIcon ? <Icon name={labelIcon} size={20} color={colors.doctor} /> : null}
        <Text style={styles.label}>{label}</Text>
        {requirement ? (
          <Text style={styles.requirement}>{requirement}</Text>
        ) : null}
      </View>
      <TextInput
        placeholderTextColor={colors.faint}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={[
          styles.input,
          { borderColor },
          props.multiline && styles.inputMultiline,
          style,
        ]}
      />
      {error ? (
        <Text style={styles.errorHint}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/**
 * Filter toggles and single-select options. Pills are allowed here.
 *
 * `options` are the values that are saved; `optionLabel` turns one into the
 * text shown, so a value can stay English while the chip is translated.
 */
export function ChoiceChips({
  label,
  options,
  value,
  onChange,
  tone = "patient",
  optionLabel = (option) => option,
}: {
  label?: string;
  options: readonly string[];
  value: string | null;
  onChange: (next: string) => void;
  tone?: Tone;
  optionLabel?: (option: string) => string;
}) {
  const { base } = TONES[tone];
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
                selected && { backgroundColor: base, borderColor: base },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selected && { color: TONES[tone].on },
                ]}
              >
                {optionLabel(option)}
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
  optionLabel = (option) => option,
}: {
  label?: string;
  options: readonly string[];
  values: string[];
  onChange: (next: string[]) => void;
  tone?: Tone;
  optionLabel?: (option: string) => string;
}) {
  const { base, on } = TONES[tone];
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
                selected && { backgroundColor: base, borderColor: base },
              ]}
            >
              {selected ? <Icon name="check" size={16} color={on} /> : null}
              <Text style={[styles.chipText, selected && { color: on }]}>
                {optionLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** 24x24 ring inside a 48x48 touch target, per DESIGN.md. */
export function Checkbox({
  label,
  value,
  onValueChange,
  tone = "patient",
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  tone?: Tone;
}) {
  const { base, on } = TONES[tone];
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
        {value ? <Icon name="check" size={18} color={on} /> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

// --- Status ------------------------------------------------------------------

/** Triage/health status chip: 36px tall, solid fill, white text. */
export function Badge({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: string;
}) {
  const { base, on } = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: base }]}>
      {icon ? <Icon name={icon} size={14} color={on} /> : null}
      <Text style={[styles.badgeText, { color: on }]}>{label}</Text>
    </View>
  );
}

/** Quieter variant for metadata that is not a clinical status. */
export function SoftBadge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
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

/** Errors are amber, never red. */
export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useT();
  return (
    <View style={styles.errorBanner}>
      <Icon name="warning" size={22} color={colors.warning} />
      <View style={styles.errorBody}>
        <Text style={styles.errorText}>{message}</Text>
        {onRetry ? (
          <LinkButton title={t("common.tryAgain")} onPress={onRetry} tone="warning" />
        ) : null}
      </View>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  icon,
}: {
  title: string;
  body?: string;
  icon?: string;
}) {
  return (
    <View style={styles.empty}>
      {icon ? <Icon name={icon} size={40} color={colors.outlineVariant} /> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenPadding: {
    padding: spacing.margin,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.margin,
    paddingTop: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.headlineMd,
    color: colors.text,
    marginTop: spacing.sm,
  },

  listRow: {
    ...elevation.level1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 80,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  rowPressed: { backgroundColor: colors.surfaceContainerLow },
  listRowBody: { flex: 1, minWidth: 0, gap: 2 },
  listRowTitle: { ...type.labelLg, color: colors.text },
  listRowSubtitle: { ...type.bodyLg, fontSize: 16, lineHeight: 24, color: colors.muted },

  tile: {
    ...elevation.level1,
    flex: 1,
    minHeight: 150,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tileTitle: { ...type.labelLg, color: colors.text, marginTop: spacing.xs },
  tileSubtitle: { ...type.bodyLg, fontSize: 16, lineHeight: 24, color: colors.muted },

  infoNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  infoNoteText: { ...type.bodyLg, fontSize: 16, lineHeight: 24, color: colors.text, flex: 1 },

  header: { gap: spacing.xs },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: { ...type.headlineXlMobile, color: colors.text, flex: 1 },
  headerSubtitle: { ...type.bodyXl, color: colors.muted },

  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  buttonText: {
    ...type.labelLg,
    fontSize: 19,
    textAlign: "center",
    flexShrink: 1,
  },
  linkButton: { ...type.labelLg, paddingVertical: spacing.xs },

  field: { gap: spacing.xs },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  label: { ...type.labelLg, color: colors.text, flex: 1 },
  requirement: { ...type.labelMd, fontFamily: type.bodyLg.fontFamily, color: colors.muted },
  hint: { ...type.labelMd, color: colors.muted },
  errorHint: { ...type.labelMd, color: colors.warning },
  input: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touch.patientAction,
    ...type.bodyLg,
    color: colors.text,
  },
  inputMultiline: { minHeight: 112, textAlignVertical: "top", paddingTop: spacing.md },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: touch.chip,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  chipText: { ...type.labelMd, color: colors.muted },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: touch.min,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2.5,
    borderColor: colors.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: { flex: 1, ...type.bodyMd, color: colors.text },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-start",
  },
  badgeText: { ...type.labelMd },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
  centeredText: { ...type.bodyLg, color: colors.muted },

  errorBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
  },
  errorBody: { flex: 1, gap: spacing.xs },
  errorText: { ...type.bodyLg, color: colors.text },

  empty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: { ...type.headlineMd, color: colors.text, textAlign: "center" },
  emptyBody: { ...type.bodyLg, color: colors.muted, textAlign: "center" },
});
