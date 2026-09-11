import * as Clipboard from "expo-clipboard";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Card, ErrorBanner, Screen } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { colors, radius, shadow, spacing } from "@/lib/theme";

const EMERGENCY_NUMBER = "112";

type Fix = { latitude: number; longitude: number; accuracy: number | null; at: string };

export default function EmergencySOS() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // No synchronous setState, so this is safe to call straight from an effect.
  const acquire = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(
          "Location permission was denied. Allow location access to read your position out on the call.",
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      // Clear any error from an earlier attempt now that we have a fix.
      setLocationError(null);
      setFix({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        at: new Date(position.timestamp).toISOString(),
      });
    } catch {
      setLocationError("Could not get your location. Check that GPS is switched on.");
    } finally {
      setLocating(false);
    }
  }, []);

  // Retry and the refresh button are event handlers, where clearing the old
  // fix and showing the spinner immediately is fine.
  const locate = useCallback(() => {
    setLocating(true);
    setLocationError(null);
    acquire();
  }, [acquire]);

  // Re-acquire whenever the screen is opened: a stale fix is no use on a call.
  useFocusEffect(
    useCallback(() => {
      acquire();
    }, [acquire]),
  );

  const locationText = fix
    ? `Latitude ${fix.latitude.toFixed(6)}, Longitude ${fix.longitude.toFixed(6)}`
    : "";

  async function copyLocation() {
    if (!locationText) return;
    await Clipboard.setStringAsync(locationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen>
      <Card style={styles.callCard}>
        <Text style={styles.callLabel}>India emergency number</Text>
        <Text style={styles.callNumber}>{EMERGENCY_NUMBER}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`)}
          style={({ pressed }) => [styles.callButton, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.callButtonText}>Call {EMERGENCY_NUMBER} now</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.sectionHeading}>Read this out on the call</Text>

        {locationError ? (
          <ErrorBanner message={locationError} onRetry={locate} />
        ) : null}

        {fix ? (
          <>
            <View style={styles.coordBlock}>
              <Text style={styles.coordLabel}>Latitude</Text>
              <Text style={styles.coordValue} selectable>
                {fix.latitude.toFixed(6)}
              </Text>
            </View>
            <View style={styles.coordBlock}>
              <Text style={styles.coordLabel}>Longitude</Text>
              <Text style={styles.coordValue} selectable>
                {fix.longitude.toFixed(6)}
              </Text>
            </View>
            <Text style={styles.fixMeta}>
              {fix.accuracy !== null
                ? `Accurate to about ${Math.round(fix.accuracy)} m - `
                : ""}
              {formatDateTime(fix.at)}
            </Text>
            <Button
              title={copied ? "✓  Copied" : "Copy location"}
              onPress={copyLocation}
              tone="danger"
              variant="outline"
            />
          </>
        ) : !locationError ? (
          <Text style={styles.locating}>
            {locating ? "Finding your location..." : "No location yet."}
          </Text>
        ) : null}

        <Button
          title="Refresh location"
          onPress={locate}
          tone="neutral"
          variant="outline"
          loading={locating}
        />
      </Card>

      <Text style={styles.disclaimer}>
        MedLink does not contact emergency services for you. Place the call yourself
        and read out your location. Automatic alerting arrives in a later release.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  callCard: {
    backgroundColor: colors.danger,
    borderColor: "#9E1F1F",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  callLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.8)",
  },
  callNumber: {
    fontSize: 68,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 2,
    lineHeight: 76,
  },
  callButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
    ...shadow,
  },
  callButtonText: { color: colors.danger, fontSize: 18, fontWeight: "800" },

  sectionHeading: { fontSize: 17, fontWeight: "700", color: colors.text },
  coordBlock: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  coordLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: colors.faint,
  },
  coordValue: { fontSize: 30, fontWeight: "800", color: colors.text, letterSpacing: 1 },
  fixMeta: { fontSize: 13, color: colors.muted },
  locating: { fontSize: 15, color: colors.muted },

  disclaimer: {
    fontSize: 13,
    color: colors.faint,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
  },
});
