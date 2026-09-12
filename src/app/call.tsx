import { AudioSession, VideoTrack } from "@livekit/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ConnectionState,
  LocalTrackPublication,
  Participant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  TrackPublication,
} from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { colors, radius, spacing } from "@/lib/theme";

/** Matches @livekit/components-core's TrackReference, which VideoTrack expects. */
type TrackRef = {
  participant: Participant;
  publication: TrackPublication;
  source: Track.Source;
};

function cameraRef(
  participant: Participant,
  publication: TrackPublication | undefined,
): TrackRef | null {
  if (!publication) return null;
  return { participant, publication, source: Track.Source.Camera };
}

async function requestAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    PermissionsAndroid.PERMISSIONS.CAMERA,
  ]);
  // The camera is optional - a call can go ahead on audio alone, which is what
  // most rural connections will manage anyway.
  return (
    granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
    PermissionsAndroid.RESULTS.GRANTED
  );
}

function ControlButton({
  label,
  icon,
  active,
  danger,
  onPress,
}: {
  label: string;
  icon: string;
  active?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        danger && styles.controlDanger,
        !danger && active === false && styles.controlOff,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={styles.controlIcon}>{icon}</Text>
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    token: string;
    serverUrl: string;
    roomName: string;
    peerName: string;
    consultationId: string;
    role: string;
  }>();

  const isDoctor = params.role === "doctor";
  const room = useMemo(() => new Room({ adaptiveStream: true }), []);
  // Guards against ending the consultation twice (button plus unmount).
  const closed = useRef(false);

  const [connection, setConnection] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [error, setError] = useState<string | null>(null);
  const [peerJoined, setPeerJoined] = useState(false);
  const [remoteVideo, setRemoteVideo] = useState<TrackRef | null>(null);
  const [localVideo, setLocalVideo] = useState<TrackRef | null>(null);
  // Audio-first: video is opt-in, so a weak rural connection still gets a call.
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);

  const leave = useCallback(
    async (goBack: boolean) => {
      if (closed.current) return;
      closed.current = true;
      try {
        await room.disconnect();
      } catch {
        // already gone
      }
      // Only the doctor closes the consultation record, so a patient who drops
      // out by accident can still rejoin from their home screen.
      if (isDoctor && params.consultationId) {
        try {
          await api.endConsultation(Number(params.consultationId));
        } catch {
          // the call is over either way
        }
      }
      if (goBack) router.back();
    },
    [room, isDoctor, params.consultationId, router],
  );

  useEffect(() => {
    let cancelled = false;

    const onState = (state: ConnectionState) => setConnection(state);

    const onParticipant = () => {
      setPeerJoined(room.remoteParticipants.size > 0);
    };

    const onSubscribed = (
      _track: RemoteTrack,
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      setPeerJoined(true);
      if (publication.source === Track.Source.Camera) {
        setRemoteVideo(cameraRef(participant, publication));
      }
    };

    const onUnsubscribed = (
      _track: RemoteTrack,
      publication: RemoteTrackPublication,
    ) => {
      if (publication.source === Track.Source.Camera) setRemoteVideo(null);
    };

    const onLocalPublished = (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.Camera) {
        setLocalVideo(cameraRef(room.localParticipant, publication));
      }
    };

    const onLocalUnpublished = (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.Camera) setLocalVideo(null);
    };

    const onDisconnected = () => {
      setConnection(ConnectionState.Disconnected);
      setPeerJoined(false);
    };

    room
      .on(RoomEvent.ConnectionStateChanged, onState)
      .on(RoomEvent.ParticipantConnected, onParticipant)
      .on(RoomEvent.ParticipantDisconnected, onParticipant)
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onUnsubscribed)
      .on(RoomEvent.LocalTrackPublished, onLocalPublished)
      .on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished)
      .on(RoomEvent.Disconnected, onDisconnected);

    (async () => {
      try {
        await AudioSession.startAudioSession();

        const micAllowed = await requestAndroidPermissions();
        if (!micAllowed) {
          if (!cancelled) {
            setError(
              "Microphone permission is needed for a consultation. Allow it and try again.",
            );
          }
          return;
        }

        if (!params.token || !params.serverUrl) {
          if (!cancelled) setError("This call link is incomplete.");
          return;
        }

        await room.connect(params.serverUrl, params.token);
        if (cancelled) return;

        await room.localParticipant.setMicrophoneEnabled(true);
        setPeerJoined(room.remoteParticipants.size > 0);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not join the consultation.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      room
        .off(RoomEvent.ConnectionStateChanged, onState)
        .off(RoomEvent.ParticipantConnected, onParticipant)
        .off(RoomEvent.ParticipantDisconnected, onParticipant)
        .off(RoomEvent.TrackSubscribed, onSubscribed)
        .off(RoomEvent.TrackUnsubscribed, onUnsubscribed)
        .off(RoomEvent.LocalTrackPublished, onLocalPublished)
        .off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished)
        .off(RoomEvent.Disconnected, onDisconnected);
      room.disconnect().catch(() => undefined);
      AudioSession.stopAudioSession().catch(() => undefined);
    };
  }, [room, params.token, params.serverUrl]);

  // Leaving by any route - the End button, or the Android back button - has to
  // close the consultation, otherwise the patient keeps being prompted to join
  // a call the doctor has already walked away from.
  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);
  useEffect(() => () => void leaveRef.current(false), []);

  async function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
    } catch {
      setMicOn(!next);
    }
  }

  async function toggleCamera() {
    const next = !cameraOn;
    setCameraOn(next);
    try {
      await room.localParticipant.setCameraEnabled(next);
    } catch {
      setCameraOn(!next);
    }
  }

  const connected = connection === ConnectionState.Connected;
  const statusLine = error
    ? "Call failed"
    : connection === ConnectionState.Connecting
      ? "Connecting..."
      : connection === ConnectionState.Reconnecting
        ? "Reconnecting..."
        : !connected
          ? "Disconnected"
          : peerJoined
            ? "Connected"
            : `Waiting for ${params.peerName || "the other person"} to join...`;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.peerName}>{params.peerName || "Consultation"}</Text>
        <View style={styles.statusRow}>
          {!connected && !error ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : null}
          <Text style={styles.status}>{statusLine}</Text>
        </View>
      </View>

      <View style={styles.stage}>
        {error ? (
          <View style={styles.placeholder}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : remoteVideo ? (
          <VideoTrack trackRef={remoteVideo} style={styles.remoteVideo} objectFit="cover" />
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(params.peerName || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.placeholderText}>
              {peerJoined
                ? "Camera is off - audio only"
                : "Waiting for them to join"}
            </Text>
          </View>
        )}

        {localVideo ? (
          <VideoTrack
            trackRef={localVideo}
            style={styles.localVideo}
            objectFit="cover"
            mirror
            zOrder={1}
          />
        ) : null}
      </View>

      <View style={styles.controls}>
        <ControlButton
          label={micOn ? "Mute" : "Unmute"}
          icon={micOn ? "🎙️" : "🔇"}
          active={micOn}
          onPress={toggleMic}
        />
        <ControlButton
          label={cameraOn ? "Stop video" : "Start video"}
          icon={cameraOn ? "📹" : "📴"}
          active={cameraOn}
          onPress={toggleCamera}
        />
        <ControlButton label="End" icon="📞" danger onPress={() => leave(true)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B1220" },

  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 2 },
  peerName: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  status: { color: "rgba(255,255,255,0.72)", fontSize: 14 },

  stage: {
    flex: 1,
    margin: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "#131C2E",
  },
  remoteVideo: { flex: 1 },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.xl,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.patient,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 42, fontWeight: "800" },
  placeholderText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    textAlign: "center",
  },
  errorText: {
    color: "#FF9B9B",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },

  localVideo: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    width: 104,
    height: 150,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#000000",
  },

  controls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  control: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 88,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  controlOff: { backgroundColor: "rgba(255,255,255,0.06)" },
  controlDanger: { backgroundColor: colors.danger },
  controlIcon: { fontSize: 22 },
  controlLabel: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
});
