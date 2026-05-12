"use client";

import type { Results } from "@mediapipe/hands";
import type { GestureState, HandLandmark } from "./types";
import { COLS } from "../tetris/types";
import {
  createOverlayState,
  drawHandOverlay,
  type OverlayDotState,
  type VideoRect,
} from "../render/handOverlay";

// ----- Tunables -----
const SMOOTHING_ALPHA = 0.35;
const COLUMN_HYSTERESIS = 0.65;
const PINCH_THRESHOLD = 0.35; // normalized (pinchDist / handSize)
const PINCH_RELEASE = 0.5; // hysteresis: must open past this to clear pinch
const PINCH_COOLDOWN_MS = 280;
const POST_PINCH_FREEZE_MS = 200;
const DROP_Y_THRESHOLD = 0.7;

// ----- Private rolling state — one tracker per page, so module-level is fine.
let prevPinched = false;
let lastPinchTime = 0;

export function onHandResults(
  results: Results,
  gestureRef: React.MutableRefObject<GestureState>,
  movementFreezeUntilRef: React.MutableRefObject<number>,
): void {
  const g = gestureRef.current;
  const handsLandmarks = results.multiHandLandmarks;

  if (!handsLandmarks || handsLandmarks.length === 0) {
    g.handVisible = false;
    g.rawLandmarks = null;
    g.pinchActive = false;
    g.dropZoneActive = false;
    prevPinched = false;
    return;
  }

  const lm = handsLandmarks[0] as HandLandmark[];
  g.handVisible = true;
  g.rawLandmarks = lm;

  // ---- X position (mirrored to match the flipped video) ----
  const indexTip = lm[8];
  const mirroredX = 1 - indexTip.x;
  g.smoothedX =
    g.smoothedX * (1 - SMOOTHING_ALPHA) + mirroredX * SMOOTHING_ALPHA;

  const rawColumn = clamp(g.smoothedX * COLS, 0, COLS - 0.001);
  // Hysteresis: only commit a new integer column when we drift past the band.
  if (Math.abs(rawColumn - g.currentColumnFloat) > COLUMN_HYSTERESIS) {
    g.currentColumnFloat = rawColumn;
  }
  g.targetColumn = Math.max(
    0,
    Math.min(COLS - 1, Math.floor(g.currentColumnFloat)),
  );

  // ---- Pinch (3D, hand-size-normalised) ----
  const thumbTip = lm[4];
  const wrist = lm[0];
  const middleBase = lm[9];
  const handSize = distance3(wrist, middleBase);
  const pinchDist = distance3(indexTip, thumbTip);
  const normalizedPinch = handSize > 0 ? pinchDist / handSize : 1;
  g.normalizedPinch = normalizedPinch;

  // Require the non-pinching fingers (middle, ring, pinky) to be extended.
  // A folded fist with thumb+index touching should NOT trigger a rotate.
  const handOpen =
    isFingerExtended(lm, 12, 10, wrist, handSize) &&
    isFingerExtended(lm, 16, 14, wrist, handSize) &&
    isFingerExtended(lm, 20, 18, wrist, handSize);

  // Hysteresis on pinch open/close — gated by an open hand on rising edge,
  // but a pinch that's already active is allowed to hold even if the other
  // fingers wobble slightly, until the user opens the thumb/index gap.
  let isPinched: boolean;
  if (prevPinched) {
    isPinched = normalizedPinch < PINCH_RELEASE;
  } else {
    isPinched = normalizedPinch < PINCH_THRESHOLD && handOpen;
  }

  const now = performance.now();
  if (isPinched && !prevPinched && now - lastPinchTime > PINCH_COOLDOWN_MS) {
    lastPinchTime = now;
    g.pinchRisingEdge = true;
    movementFreezeUntilRef.current = now + POST_PINCH_FREEZE_MS;
  }
  prevPinched = isPinched;
  g.pinchActive = isPinched;

  // ---- Drop zone ----
  g.indexTipY = indexTip.y;
  g.dropZoneActive = indexTip.y > DROP_Y_THRESHOLD;
}


// ----- 2D overlay drawing loop -----

export function attachOverlayLoop(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  gestureRef: React.MutableRefObject<GestureState>,
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const state: OverlayDotState = createOverlayState();
  let rafId = 0;
  let stopped = false;

  const fit = () => {
    // Match canvas internal size to video display size for crisp drawing.
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  // Also re-fit once the video has loaded, in case dimensions changed.
  const onLoaded = () => fit();
  video.addEventListener("loadedmetadata", onLoaded);

  const draw = () => {
    if (stopped) return;
    const rect = canvas.getBoundingClientRect();
    const g = gestureRef.current;
    const videoRect = computeVideoRect(
      rect.width,
      rect.height,
      video.videoWidth,
      video.videoHeight,
    );
    drawHandOverlay({
      ctx,
      width: rect.width,
      height: rect.height,
      videoRect,
      landmarks: g.rawLandmarks,
      normalizedPinch: g.normalizedPinch,
      dropZoneActive: g.dropZoneActive,
      pinchActive: g.pinchActive,
      state,
    });
    rafId = requestAnimationFrame(draw);
  };
  rafId = requestAnimationFrame(draw);

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
    ro.disconnect();
    video.removeEventListener("loadedmetadata", onLoaded);
  };
}

// ----- helpers -----
function distance3(a: HandLandmark, b: HandLandmark): number {
  const dz = (a.z ?? 0) - (b.z ?? 0);
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy, dz);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * True when the given finger is extended — i.e. its tip sits meaningfully
 * farther from the wrist than its PIP joint, scaled by hand size so the
 * check is invariant to camera distance.
 */
function isFingerExtended(
  lm: HandLandmark[],
  tipIdx: number,
  pipIdx: number,
  wrist: HandLandmark,
  handSize: number,
): boolean {
  if (handSize <= 0) return false;
  const tipToWrist = distance3(lm[tipIdx], wrist);
  const pipToWrist = distance3(lm[pipIdx], wrist);
  return tipToWrist > pipToWrist + 0.08 * handSize;
}

/**
 * Fit calculation matching `object-fit: cover`. Returns the rect occupied by
 * the source video inside a (cw, ch)-sized canvas, with the overflowing axis
 * extending beyond the canvas bounds. Falls back to the full canvas while
 * metadata is loading.
 */
function computeVideoRect(
  cw: number,
  ch: number,
  vw: number,
  vh: number,
): VideoRect {
  if (!vw || !vh) return { x: 0, y: 0, w: cw, h: ch };
  const videoAspect = vw / vh;
  const canvasAspect = cw / ch;
  if (videoAspect > canvasAspect) {
    // wider than canvas → overflow left/right (height fills)
    const h = ch;
    const w = ch * videoAspect;
    return { x: (cw - w) / 2, y: 0, w, h };
  }
  // taller than canvas → overflow top/bottom (width fills)
  const w = cw;
  const h = cw / videoAspect;
  return { x: 0, y: (ch - h) / 2, w, h };
}
