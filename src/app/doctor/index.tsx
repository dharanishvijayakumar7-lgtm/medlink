import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FacilityPicker } from "@/components/facility-picker";
import { Icon } from "@/components/icon";
import {
  Button,
  Card,
  ChoiceChips,
  ErrorBanner,
  Screen,
  TextField,
} from "@/components/ui";
import { api, Facility } from "@/lib/api";
import { useDoctorSession } from "@/lib/doctor-session";
import { colors, radius, spacing, type } from "@/lib/theme";

const SPECIALIZATIONS = [
  "General Medicine",
  "Obstetrics & Gynaecology",
  "Paediatrics",
  "Community Medicine",
  "Surgery",
  "Other",
] as const;

const ASSURANCES: { icon: string; title: string; caption: string }[] = [
  { icon: "lock", title: "EHR Encrypted", caption: "Records stay on your server" },
  { icon: "sync_alt", title: "Rural Tele-Sync", caption: "Works on weak links" },
];

/**
 * Doctor identity capture. This is not a login - it records who is using the
 * app so consultation notes can be attributed. Credential verification (the
 * council-ID field in the mockup) arrives in Part 3.
 */
export default function DoctorIdentity() {
  const router = useRouter();
  const { setDoctor } = useDoctorSession();

  const [name, setName] = useState("");
  const [specialization, setSpecialization] = useState<string | null>(
    "General Medicine",
  );
  const [customSpecialization, setCustomSpecialization] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFacilities = useCallback(async () => {
    try {
      setFacilities(await api.getFacilities());
    } catch {
      // Not fatal: a doctor can start a session without picking a facility.
      setFacilities([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFacilities();
    }, [loadFacilities]),
  );

  const resolved =
    specialization === "Other" ? customSpecialization.trim() : specialization ?? "";

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!resolved) {
      setError("Please enter your specialization.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const doctor = await api.createDoctor({
        name: name.trim(),
        specialization: resolved,
        facility_id: facilityId,
      });
      setDoctor(doctor);
      router.replace("/doctor/queue");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Card>
        <View style={styles.topRow}>
          <View style={styles.verifiedPill}>
            <Icon name="verified_user" size={16} color={colors.onSecondaryContainer} />
            <Text style={styles.verifiedText}>Verified Clinical Network</Text>
          </View>
          <Text style={styles.stepText}>Step 1 of 1</Text>
        </View>

        <Text style={styles.title}>Physician Portal Onboarding</Text>
        <Text style={styles.body}>
          Identify yourself to access the patient queue, triage telemetry and
          clinical notes. No password in this build - this tags the notes you
          write, and the session ends when you close the app.
        </Text>

        <View style={styles.assuranceGrid}>
          {ASSURANCES.map((item) => (
            <View key={item.title} style={styles.assurance}>
              <View style={styles.assuranceIcon}>
                <Icon name={item.icon} size={18} color={colors.onDoctor} />
              </View>
              <View style={styles.assuranceBody}>
                <Text style={styles.assuranceTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.assuranceCaption} numberOfLines={1}>
                  {item.caption}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      <Card style={styles.formCard}>
        <TextField
          label="Full Practitioner Name"
          labelIcon="badge"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Anita Sharma"
          autoCapitalize="words"
          hint="As inscribed in the State or National Medical Register."
        />
        <ChoiceChips
          label="Specialization"
          options={SPECIALIZATIONS}
          value={specialization}
          onChange={setSpecialization}
          tone="doctor"
        />
        {specialization === "Other" ? (
          <TextField
            label="Specialization"
            labelIcon="clinical_notes"
            value={customSpecialization}
            onChangeText={setCustomSpecialization}
            placeholder="Enter your specialization"
            autoCapitalize="words"
          />
        ) : null}
        <FacilityPicker
          label="Your facility (optional)"
          facilities={facilities}
          selectedId={facilityId}
          onSelect={setFacilityId}
          emptyLabel="Not attached to a facility"
          hint="Sets the default facility whose stock and dashboard you manage."
        />
      </Card>

      <Button
        title="Start session"
        icon="login"
        onPress={handleSubmit}
        loading={submitting}
        tone="doctor"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.secondaryContainer,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  verifiedText: { ...type.labelMd, color: colors.onSecondaryContainer },
  stepText: { ...type.labelMd, color: colors.faint },

  title: { ...type.headlineMd, color: colors.text, marginTop: spacing.xs },
  body: { ...type.bodyMd, color: colors.muted },

  assuranceGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  assurance: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  assuranceIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.doctor,
    alignItems: "center",
    justifyContent: "center",
  },
  assuranceBody: { flex: 1, minWidth: 0 },
  assuranceTitle: { ...type.labelMd, color: colors.text },
  assuranceCaption: { ...type.labelMd, color: colors.muted },

  formCard: { gap: spacing.md },
});
