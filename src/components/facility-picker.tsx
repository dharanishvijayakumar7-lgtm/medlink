import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FacilitySummary } from "@/lib/api";
import { colors, radius, spacing } from "@/lib/theme";

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
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(!open)}
        style={styles.trigger}
      >
        <Text
          style={[styles.value, !selected && styles.placeholder]}
          numberOfLines={1}
        >
          {selected ? selected.name : emptyLabel}
        </Text>
        <Text style={styles.chevron}>{open ? "⌃" : "⌄"}</Text>
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
                  {facility.type} - {facility.area_label}
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
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  hint: { fontSize: 12, color: colors.muted },

  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  value: { flex: 1, fontSize: 16, color: colors.text },
  placeholder: { color: colors.faint },
  chevron: { fontSize: 18, color: colors.muted, fontWeight: "700" },

  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowBody: { flex: 1, gap: 2 },
  rowText: { fontSize: 15, color: colors.text, fontWeight: "500" },
  rowMeta: { fontSize: 12, color: colors.muted },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioOn: { borderColor: colors.doctor, borderWidth: 6 },
});
