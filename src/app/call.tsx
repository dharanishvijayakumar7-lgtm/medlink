import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui";
import { isWebRtcAvailable } from "@/lib/livekit";
import { colors, overlay, radius, spacing, type } from "@/lib/theme";

/**
 * The call route.
 *
 * The real screen lives in `@/components/live-call` and is only pulled in when
 * the native WebRTC module exists. expo-router imports every route module while
 * building the route tree, so a static import here would crash the whole app in
 * Expo Go rather than just this one screen.
 */
const LiveCall: (() => React.ReactElement) | null = isWebRtcAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@/components/live-call").LiveCall
  : null;

function CallUnavailable() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Icon name="videocam_off" size={48} color={colors.inverseOnSurface} />
        <Text style={styles.title}>Video calls need a development build</Text>
        <Text style={styles.text}>
          Expo Go does not include the WebRTC module LiveKit needs, so
          consultations cannot run here. Everything else in the app works
          normally.
        </Text>
        <View style={styles.commandBox}>
          <Text style={styles.command}>npx expo run:android</Text>
        </View>
        {/* Solid, not outline: a teal outline is too faint on the dark screen. */}
        <Button title="Go back" onPress={() => router.back()} tone="patient" />
      </View>
    </SafeAreaView>
  );
}

export default function CallScreen() {
  return LiveCall ? <LiveCall /> : <CallUnavailable />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xl,
  },
  title: { ...type.headlineMd, color: colors.inverseOnSurface, textAlign: "center" },
  text: { ...type.bodyLg, color: overlay.onColorText, textAlign: "center" },
  commandBox: {
    backgroundColor: overlay.onColorFill,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  command: { ...type.labelLg, color: colors.patientTint },
});
