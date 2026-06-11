"use client";

import type { Results } from "@mediapipe/hands";

// Pinned to the exact installed package version. jsdelivr serves versioned
// URLs immutably, so the wasm/model assets can't change underneath us the
// way an unversioned `@mediapipe/hands` URL (-> latest) could. SRI hashes
// aren't applicable here: the library fetches its own assets at runtime, so
// version-pinning is the available integrity control. Keep in sync with
// package.json when upgrading.
const MP_HANDS_VERSION = "0.4.1675469240";
const MP_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MP_HANDS_VERSION}`;

// ----- Detection tunables -----
const MAX_NUM_HANDS = 1;
// 0 = lite model (faster, less accurate), 1 = full. The game is desktop-only
// (mobile is gated out), so spend the budget on accuracy.
const MODEL_COMPLEXITY = 1;
// Palm detection must be at least this confident to acquire a hand.
const MIN_DETECTION_CONFIDENCE = 0.7;
// Below this the tracker gives up and falls back to detection instead of
// following a low-quality track. Raised from the 0.5 default: re-detecting
// for a frame beats steering off garbage landmarks.
const MIN_TRACKING_CONFIDENCE = 0.6;

// 1280×720 is the most common 16:9 webcam mode and gives roughly twice the
// horizontal area of 640×480, so the player can move further out before
// falling off-frame. Cameras that can't deliver it gracefully negotiate
// down. MediaPipe downscales internally to its model input size, so the
// extra pixels cost capture bandwidth, not inference time.
const CAMERA_WIDTH = 1280;
const CAMERA_HEIGHT = 720;

/**
 * Boot MediaPipe Hands with the camera. Returns a stop function that releases
 * the camera and tracker.
 *
 * Loaded dynamically — MediaPipe touches `window` during construction and
 * can't be imported at module top level on the server.
 */
export async function bootHandTracker(
  video: HTMLVideoElement,
  onResults: (results: Results) => void,
): Promise<() => void> {
  if (typeof window === "undefined") {
    throw new Error("bootHandTracker is browser-only");
  }

  const handsModule = await import("@mediapipe/hands");
  const cameraModule = await import("@mediapipe/camera_utils");
  const { Hands } = handsModule;
  const { Camera } = cameraModule;

  const hands = new Hands({
    locateFile: (file: string) => `${MP_CDN}/${file}`,
  });
  hands.setOptions({
    maxNumHands: MAX_NUM_HANDS,
    modelComplexity: MODEL_COMPLEXITY,
    minDetectionConfidence: MIN_DETECTION_CONFIDENCE,
    minTrackingConfidence: MIN_TRACKING_CONFIDENCE,
  });
  hands.onResults(onResults);

  let stopped = false;
  const camera = new Camera(video, {
    onFrame: async () => {
      if (stopped) return;
      await hands.send({ image: video });
    },
    width: CAMERA_WIDTH,
    height: CAMERA_HEIGHT,
    facingMode: "user",
  });

  await camera.start();

  return () => {
    if (stopped) return;
    stopped = true;
    void camera.stop();
    void hands.close();
    // Belt and braces: Camera.stop() stops the stream's tracks, but make
    // sure the element releases its reference too so the webcam light goes
    // off everywhere.
    const stream = video.srcObject;
    if (stream instanceof MediaStream) {
      for (const track of stream.getTracks()) track.stop();
    }
    video.srcObject = null;
  };
}
