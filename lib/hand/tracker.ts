"use client";

import type { Results } from "@mediapipe/hands";

const MP_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/hands";

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
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
  });
  hands.onResults(onResults);

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    // 1280×720 is the most common 16:9 webcam mode and gives roughly twice
    // the horizontal area of 640×480, so the player can move further out
    // before falling off-frame. Cameras that can't deliver it gracefully
    // negotiate down.
    width: 1280,
    height: 720,
    facingMode: "user",
  });

  await camera.start();

  return () => {
    void camera.stop();
    void hands.close();
  };
}
