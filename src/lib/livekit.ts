/**
 * Guarded LiveKit bootstrap.
 *
 * `@livekit/react-native` throws at *import* time when the native WebRTC module
 * is missing - which is the case in Expo Go, since it ships no LiveKit native
 * code. Importing it from the root layout therefore took the whole app down:
 * every route failed to load, not just the call screen.
 *
 * A video-call dependency should never be able to break symptom checks or the
 * doctor queue, so the import is wrapped here and the rest of the app asks
 * `isWebRtcAvailable` before going anywhere near a room. Only a development
 * build (`npx expo run:android`) has the native module.
 *
 * `require` rather than `import`: ES imports are hoisted, so a static import
 * cannot be caught.
 */

function bootstrap(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const livekit = require("@livekit/react-native");
    livekit.registerGlobals();
    return true;
  } catch {
    return false;
  }
}

/** True when this build can actually join a consultation room. */
export const isWebRtcAvailable = bootstrap();
