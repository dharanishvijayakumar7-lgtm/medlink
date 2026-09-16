import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { Badge, toneColor, Tone } from "@/components/ui";
import { Referral, ReferralStatus } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { TranslationKey, useT } from "@/lib/i18n";
import { colors, elevation, radius, spacing, type } from "@/lib/theme";

/** `label` and `patientLabel` are translation keys. */
type StatusMeta = { label: TranslationKey; patientLabel: TranslationKey; tone: Tone };

export const REFERRAL_STATUS_META: Record<ReferralStatus, StatusMeta> = {
  PENDING: {
    label: "referral.pending",
    patientLabel: "referral.pendingPatient",
    tone: "warning",
  },
  CONFIRMED: {
    label: "referral.confirmed",
    patientLabel: "referral.confirmedPatient",
    tone: "doctor",
  },
  COMPLETED: {
    label: "referral.completed",
    patientLabel: "referral.completedPatient",
    tone: "success",
  },
  NO_SHOW: {
    label: "referral.noShow",
    patientLabel: "referral.noShowPatient",
    tone: "warning",
  },
};

/** The happy path a referral walks through. NO_SHOW ends it off to one side. */
const STEPS: ReferralStatus[] = ["PENDING", "CONFIRMED", "COMPLETED"];

function StatusTracker({ status }: { status: ReferralStatus }) {
  const { t } = useT();
  if (status === "NO_SHOW") {
    return (
      <View style={styles.noShow}>
        <Icon name="event_busy" size={20} color={colors.warning} />
        <Text style={styles.noShowText}>{t("referral.noShowNote")}</Text>
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
                {done ? <Icon name="check" size={14} color={colors.onSuccess} /> : null}
              </View>
              {index < STEPS.length - 1 ? (
                <View style={[styles.bar, index < reached && styles.barDone]} />
              ) : null}
            </View>
            <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>
              {t(REFERRAL_STATUS_META[step].label)}
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
  const { t } = useT();
  const meta = REFERRAL_STATUS_META[referral.status];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.facilityIcon}>
          <Icon name="local_hospital" size={24} color={colors.doctor} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.category}>{t("referral.category")}</Text>
          <Text style={styles.facility}>{referral.to_facility.name}</Text>
        </View>
        <Badge label={t(meta.label).toUpperCase()} tone={meta.tone} />
      </View>

      <Text style={styles.meta}>
        {referral.to_facility.type} · {referral.to_facility.area_label}
      </Text>

      {audience === "patient" ? (
        <Text style={[styles.statusLine, { color: toneColor(meta.tone) }]}>
          {t(meta.patientLabel)}
        </Text>
      ) : null}

      <StatusTracker status={referral.status} />

      {referral.notes ? (
        <View style={styles.notes}>
          <Text style={styles.notesLabel}>{t("referral.noteLabel")}</Text>
          <Text style={styles.notesBody}>{referral.notes}</Text>
        </View>
      ) : null}

      <Text style={styles.author}>
        {t("referral.author", {
          name: referral.doctor.name,
          time: formatDateTime(referral.updated_at),
        })}
      </Text>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...elevation.level1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  facilityIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.tile,
    backgroundColor: colors.doctorTint,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { flex: 1, minWidth: 0 },
  category: { ...type.labelMd, color: colors.muted, letterSpacing: 0.8 },
  facility: { ...type.headlineMd, color: colors.text },
  meta: { ...type.bodyMd, color: colors.muted },
  statusLine: { ...type.labelLg },

  tracker: { flexDirection: "row", marginTop: spacing.xs },
  step: { flex: 1, gap: spacing.xs },
  stepTop: { flexDirection: "row", alignItems: "center" },
  dot: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  bar: { flex: 1, height: 3, backgroundColor: colors.borderStrong },
  barDone: { backgroundColor: colors.success },
  stepLabel: { ...type.labelMd, color: colors.faint },
  stepLabelDone: { color: colors.text },

  noShow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
    backgroundColor: colors.warningTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noShowText: { flex: 1, ...type.bodyLg, color: colors.text },

  notes: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  notesLabel: { ...type.labelMd, color: colors.faint, letterSpacing: 0.6 },
  notesBody: { ...type.bodyLg, color: colors.text },

  author: { ...type.labelMd, color: colors.muted },
});
