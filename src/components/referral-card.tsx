import { StyleSheet, Text, View } from "react-native";

import { Badge, Card, Tone } from "@/components/ui";
import { Referral, ReferralStatus } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { colors, radius, spacing } from "@/lib/theme";

type StatusMeta = { label: string; patientLabel: string; tone: Tone };

export const REFERRAL_STATUS_META: Record<ReferralStatus, StatusMeta> = {
  PENDING: {
    label: "Pending",
    patientLabel: "Waiting for the facility to confirm",
    tone: "warning",
  },
  CONFIRMED: {
    label: "Confirmed",
    patientLabel: "Confirmed - go when you can",
    tone: "doctor",
  },
  COMPLETED: {
    label: "Completed",
    patientLabel: "Visit completed",
    tone: "success",
  },
  NO_SHOW: {
    label: "No show",
    patientLabel: "You did not attend - contact the facility",
    tone: "danger",
  },
};

/** The happy path a referral walks through. NO_SHOW ends it off to one side. */
const STEPS: ReferralStatus[] = ["PENDING", "CONFIRMED", "COMPLETED"];

function StatusTracker({ status }: { status: ReferralStatus }) {
  if (status === "NO_SHOW") {
    return (
      <View style={styles.noShow}>
        <Text style={styles.noShowText}>
          Marked as not attended. Contact the facility to arrange another visit.
        </Text>
      </View>
    );
  }

  const reached = STEPS.indexOf(status);

  return (
    <View style={styles.tracker}>
      {STEPS.map((step, index) => {
        const done = index <= reached;
        return (
          <View key={step} style={styles.step}>
            <View style={styles.stepTop}>
              <View style={[styles.dot, done && styles.dotDone]}>
                {done ? <Text style={styles.dotTick}>{"✓"}</Text> : null}
              </View>
              {index < STEPS.length - 1 ? (
                <View style={[styles.bar, index < reached && styles.barDone]} />
              ) : null}
            </View>
            <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>
              {REFERRAL_STATUS_META[step].label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function ReferralCard({
  referral,
  audience,
  children,
}: {
  referral: Referral;
  audience: "patient" | "doctor";
  /** Doctor-side status controls, rendered under the tracker. */
  children?: React.ReactNode;
}) {
  const meta = REFERRAL_STATUS_META[referral.status];

  return (
    <Card>
      <View style={styles.headerRow}>
        <Badge label={meta.label.toUpperCase()} tone={meta.tone} />
        <Text style={styles.timestamp}>{formatDateTime(referral.created_at)}</Text>
      </View>

      <Text style={styles.facility}>{referral.to_facility.name}</Text>
      <Text style={styles.meta}>
        {referral.to_facility.type} - {referral.to_facility.area_label}
      </Text>

      {audience === "patient" ? (
        <Text style={[styles.statusLine, { color: colorFor(meta.tone) }]}>
          {meta.patientLabel}
        </Text>
      ) : null}

      <StatusTracker status={referral.status} />

      {referral.notes ? (
        <View style={styles.notes}>
          <Text style={styles.notesLabel}>Referral note</Text>
          <Text style={styles.notesBody}>{referral.notes}</Text>
        </View>
      ) : null}

      <Text style={styles.author}>
        Referred by Dr. {referral.doctor.name} - updated{" "}
        {formatDateTime(referral.updated_at)}
      </Text>

      {children}
    </Card>
  );
}

function colorFor(tone: Tone): string {
  switch (tone) {
    case "danger":
      return colors.danger;
    case "success":
      return colors.success;
    case "warning":
      return colors.warning;
    case "doctor":
      return colors.doctor;
    default:
      return colors.muted;
  }
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  timestamp: { fontSize: 12, fontWeight: "600", color: colors.faint },
  facility: { fontSize: 17, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  statusLine: { fontSize: 15, fontWeight: "600", marginTop: spacing.xs },

  tracker: { flexDirection: "row", marginTop: spacing.md },
  step: { flex: 1, gap: spacing.xs },
  stepTop: { flexDirection: "row", alignItems: "center" },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotTick: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  bar: { flex: 1, height: 3, backgroundColor: colors.border },
  barDone: { backgroundColor: colors.success },
  stepLabel: { fontSize: 11, color: colors.faint, fontWeight: "600" },
  stepLabelDone: { color: colors.text },

  noShow: {
    marginTop: spacing.sm,
    backgroundColor: colors.dangerTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noShowText: { fontSize: 14, color: colors.danger, lineHeight: 20 },

  notes: {
    marginTop: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: colors.faint,
  },
  notesBody: { fontSize: 15, color: colors.text, lineHeight: 21 },

  author: { fontSize: 12, color: colors.muted, marginTop: spacing.sm },
});
