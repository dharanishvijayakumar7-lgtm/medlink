import * as Clipboard from "expo-clipboard";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { Button, Card, ErrorBanner, Screen } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { translate, useT } from "@/lib/i18n";
import { colors, overlay, radius, spacing, touch, type } from "@/lib/theme";

const EMERGENCY_NUMBER = "112";

type Fix = { latitude: number; longitude: number; accuracy: number | null; at: string };

export default function EmergencySOS() {
  const { t } = useT();
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // No synchronous setState, so this is safe to call straight from an effect.
  const acquire = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(translate("sos.permissionDenied"));
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
      setLocationError(translate("sos.locationFailed"));
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
    ? t("sos.locationText", {
        latitude: fix.latitude.toFixed(6),
        longitude: fix.longitude.toFixed(6),
      })
    : "";

  async function copyLocation() {
    if (!locationText) return;
    await Clipboard.setStringAsync(locationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen>
      {/* Same pattern as the SOS card on the patient home mockup. */}
      <View style={styles.callCard}>
        <View style={styles.callIcon}>
          <Icon name="emergency" size={32} color={colors.onEmergency} />
        </View>
        <Text style={styles.callLabel}>{t("sos.numberLabel")}</Text>
        <Text style={styles.callNumber}>{EMERGENCY_NUMBER}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`)}
          style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
        >
          <Icon name="call" size={28} color={colors.emergency} />
          <Text style={styles.callButtonText}>
            {t("sos.callNow", { number: EMERGENCY_NUMBER })}
          </Text>
        </Pressable>
      </View>

      <Card>
        <Text style={styles.sectionHeading}>{t("sos.readOut")}</Text>

        {locationError ? (
          <ErrorBanner message={locationError} onRetry={locate} />
        ) : null}

        {fix ? (
          <>
            <View style={styles.coordBlock}>
              <Text style={styles.coordLabel}>{t("sos.latitude")}</Text>
              <Text style={styles.coordValue} selectable>
                {fix.latitude.toFixed(6)}
              </Text>
            </View>
            <View style={styles.coordBlock}>
              <Text style={styles.coordLabel}>{t("sos.longitude")}</Text>
              <Text style={styles.coordValue} selectable>
                {fix.longitude.toFixed(6)}
              </Text>
            </View>
            <Text style={styles.fixMeta}>
              {fix.accuracy !== null
                ? `${t("sos.accuracy", { meters: Math.round(fix.accuracy) })} - `
                : ""}
              {formatDateTime(fix.at)}
            </Text>
            <Button
              title={copied ? t("home.copied") : t("sos.copyLocation")}
              icon={copied ? "check" : "content_copy"}
              onPress={copyLocation}
              tone="emergency"
              variant="outline"
            />
          </>
        ) : !locationError ? (
          <Text style={styles.locating}>
            {locating ? t("sos.locating") : t("sos.noLocation")}
          </Text>
        ) : null}

        <Button
          title={t("sos.refresh")}
          onPress={locate}
          tone="neutral"
          variant="outline"
          loading={locating}
        />
      </Card>

      <Text style={styles.disclaimer}>{t("sos.disclaimer")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },

  callCard: {
    backgroundColor: colors.emergency,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  callIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: overlay.onColorFill,
    alignItems: "center",
    justifyContent: "center",
  },
  callLabel: { ...type.labelLg, color: overlay.onColorText },
  callNumber: { ...type.display, color: colors.onEmergency, letterSpacing: 2 },
  callButton: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: touch.sos,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  callButtonText: { ...type.headlineMd, color: colors.emergency },

  sectionHeading: { ...type.headlineMd, color: colors.text },
  coordBlock: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  coordLabel: { ...type.labelMd, color: colors.muted },
  // Spaced out so the digits are easy to read aloud down a bad line.
  coordValue: { ...type.headlineXl, color: colors.text, letterSpacing: 1 },
  fixMeta: { ...type.labelMd, fontFamily: type.bodyLg.fontFamily, color: colors.muted },
  locating: { ...type.bodyLg, color: colors.muted },

  disclaimer: {
    ...type.labelMd,
    fontFamily: type.bodyLg.fontFamily,
    color: colors.muted,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
  },
});
