import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Icon } from "@/components/icon";
import { formatIsoDate, isValidIsoDate, toIsoDate } from "@/lib/format";
import { colors, radius, spacing, touch, type } from "@/lib/theme";

const EARLIEST = new Date(1900, 0, 1);

/** Parse YYYY-MM-DD as a local calendar date, so no timezone shifts the day. */
function fromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * A date that has already happened: a birth date or a past hospital visit.
 *
 * Android opens the native calendar dialog, iOS shows an inline spinner, and
 * web - where the native module does not exist - falls back to typed
 * YYYY-MM-DD. Future dates cannot be picked.
 */
export function PastDateField({
  value,
  onChange,
  label,
  hint,
  placeholder,
  icon = "event",
  requirement,
  error,
  openYearsAgo = 0,
  onClear,
}: {
  /** ISO YYYY-MM-DD, or null when nothing is chosen yet. */
  value: string | null;
  onChange: (next: string) => void;
  label: string;
  hint?: string;
  placeholder: string;
  icon?: string;
  requirement?: string;
  error?: string | null;
  /** Where the picker opens when empty, in years before today. */
  openYearsAgo?: number;
  /** Shows a Clear action, for optional fields. */
  onClear?: () => void;
}) {
  const [showIos, setShowIos] = useState(false);
  const [webDraft, setWebDraft] = useState(value ?? "");
  const today = new Date();

  const initial = value
    ? fromIso(value)
    : new Date(today.getFullYear() - openYearsAgo, today.getMonth(), today.getDate());

  function open() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: initial,
        mode: "date",
        maximumDate: today,
        minimumDate: EARLIEST,
        // Only fires on a real pick; dismissing the dialog leaves the value alone.
        onValueChange: (_event, picked) => onChange(toIsoDate(picked)),
      });
    } else {
      setShowIos((shown) => !shown);
    }
  }

  const borderColor = error ? colors.warning : value ? colors.patient : colors.inputBorder;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {requirement ? <Text style={styles.requirement}>{requirement}</Text> : null}
      </View>

      {Platform.OS === "web" ? (
        <TextInput
          value={webDraft}
          onChangeText={(text) => {
            setWebDraft(text);
            if (isValidIsoDate(text.trim())) onChange(text.trim());
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.faint}
          maxLength={10}
          style={[styles.trigger, styles.webInput, { borderColor }]}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value ? `${label}: ${formatIsoDate(value)}` : placeholder}
          onPress={open}
          style={({ pressed }) => [styles.trigger, { borderColor }, pressed && styles.pressed]}
        >
          <Icon name={icon} size={24} color={value ? colors.patient : colors.faint} />
          <Text style={[styles.value, !value && styles.placeholder]}>
            {value ? formatIsoDate(value) : placeholder}
          </Text>
          <Icon name="calendar_month" size={24} color={colors.muted} />
        </Pressable>
      )}

      {Platform.OS === "ios" && showIos ? (
        <View style={styles.iosPicker}>
          <DateTimePicker
            value={initial}
            mode="date"
            display="spinner"
            maximumDate={today}
            minimumDate={EARLIEST}
            onValueChange={(_event, picked) => onChange(toIsoDate(picked))}
          />
          <Pressable onPress={() => setShowIos(false)} style={styles.iosDone} hitSlop={12}>
            <Text style={styles.iosDoneText}>Done</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.footer}>
        {error ? (
          <Text style={[styles.errorHint, styles.footerText]}>{error}</Text>
        ) : hint ? (
          <Text style={[styles.hint, styles.footerText]}>{hint}</Text>
        ) : (
          <View style={styles.footerText} />
        )}
        {onClear && value ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setWebDraft("");
              onClear();
            }}
            hitSlop={12}
          >
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Date of birth: required at registration, replaces the old typed age. */
export function DateOfBirthField({
  value,
  onChange,
  requirement,
  error,
  label = "Date of birth",
}: {
  value: string | null;
  onChange: (next: string) => void;
  requirement?: string;
  error?: string | null;
  label?: string;
}) {
  return (
    <PastDateField
      value={value}
      onChange={onChange}
      label={label}
      requirement={requirement}
      error={error}
      icon="cake"
      placeholder="Tap to choose date of birth"
      hint="Used to work out your age at every visit. Check your Aadhaar card if unsure."
      // Opening on today would make an elderly patient scroll back decades.
      openYearsAgo={30}
    />
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  label: { ...type.labelLg, color: colors.text, flex: 1 },
  requirement: { ...type.labelMd, fontFamily: type.bodyLg.fontFamily, color: colors.muted },

  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touch.patientAction,
    borderWidth: 2,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
  },
  webInput: { ...type.bodyLg, color: colors.text },
  pressed: { opacity: 0.9 },
  value: { ...type.bodyXl, color: colors.text, flex: 1 },
  placeholder: { ...type.bodyLg, color: colors.faint },

  iosPicker: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  iosDone: { alignSelf: "flex-end", padding: spacing.md },
  iosDoneText: { ...type.labelLg, color: colors.patient },

  footer: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  footerText: { flex: 1 },
  hint: { ...type.labelMd, color: colors.muted },
  errorHint: { ...type.labelMd, color: colors.warning },
  clear: { ...type.labelMd, color: colors.warning },
});
