import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { FacilitySummary } from "@/lib/api";
import { colors, radius, spacing, touch, type } from "@/lib/theme";

/** A collapsible single-select list of facilities. No picker dependency. */
export function FacilityPicker({
  label,
  facilities,
  selectedId,
  onSelect,
  hint,
  emptyLabel = "None",
  allowNone = true,
}: {
  label: string;
  facilities: FacilitySummary[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  hint?: string;
  emptyLabel?: string;
  allowNone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = facilities.find((facility) => facility.id === selectedId) ?? null;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Icon name="local_hospital" size={20} color={colors.doctor} />
        <Text style={styles.label}>{label}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(!open)}
        style={[styles.trigger, open && styles.triggerOpen]}
      >
        <Text
          style={[styles.value, !selected && styles.placeholder]}
          numberOfLines={1}
        >
          {selected ? selected.name : emptyLabel}
        </Text>
        <Icon
          name={open ? "expand_less" : "expand_more"}
          size={24}
          color={colors.muted}
        />
      </Pressable>

      {open ? (
        <View style={styles.list}>
          {allowNone ? (
            <Pressable
              onPress={() => {
                onSelect(null);
                setOpen(false);
              }}
              style={styles.row}
            >
              <View style={[styles.radio, selectedId === null && styles.radioOn]} />
              <Text style={styles.rowText}>{emptyLabel}</Text>
            </Pressable>
          ) : null}

          {facilities.map((facility) => (
            <Pressable
              key={facility.id}
              onPress={() => {
                onSelect(facility.id);
                setOpen(false);
              }}
              style={styles.row}
            >
              <View
                style={[styles.radio, selectedId === facility.id && styles.radioOn]}
              />
              <View style={styles.rowBody}>
                <Text style={styles.rowText}>{facility.name}</Text>
                <Text style={styles.rowMeta}>
                  {facility.type} · {facility.area_label}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  label: { ...type.labelLg, color: colors.text, flex: 1 },
  hint: { ...type.labelMd, color: colors.muted },

  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    minHeight: touch.patientAction,
  },
  triggerOpen: { borderColor: colors.doctor },
  value: { flex: 1, ...type.bodyLg, color: colors.text },
  placeholder: { color: colors.faint },

  list: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: touch.min,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowBody: { flex: 1, gap: 2 },
  rowText: { ...type.bodyMd, color: colors.text },
  rowMeta: { ...type.labelMd, color: colors.muted },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2.5,
    borderColor: colors.inputBorder,
  },
  radioOn: { borderColor: colors.doctor, borderWidth: 8 },
});
