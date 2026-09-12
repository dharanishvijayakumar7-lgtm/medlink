import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui";
import { isWebRtcAvailable } from "@/lib/livekit";
import { colors, radius, spacing } from "@/lib/theme";

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
        <Text style={styles.icon}>📹</Text>
        <Text style={styles.title}>Video calls need a development build</Text>
        <Text style={styles.text}>
          Expo Go does not include the WebRTC module LiveKit needs, so
          consultations cannot run here. Everything else in the app works
          normally.
        </Text>
        <View style={styles.commandBox}>
          <Text style={styles.command}>npx expo run:android</Text>
        </View>
        <Button
          title="Go back"
          onPress={() => router.back()}
          tone="patient"
          variant="outline"
        />
      </View>
    </SafeAreaView>
  );
}

export default function CallScreen() {
  return LiveCall ? <LiveCall /> : <CallUnavailable />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B1220" },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xl,
  },
  icon: { fontSize: 44 },
  title: {
    fontSize: 21,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  text: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 22,
  },
  commandBox: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  command: { color: colors.patientTint, fontSize: 15, fontWeight: "600" },
});
