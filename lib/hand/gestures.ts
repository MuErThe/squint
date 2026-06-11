"use client";

import type { Results } from "@mediapipe/hands";
import type { GestureState, HandLandmark } from "./types";
import { COLS } from "../tetris/types";
import { OneEuroFilter } from "./filters";
import {
  createOverlayState,
  drawHandOverlay,
  type DebugDrawInfo,
  type OverlayDotState,
  type VideoRect,
} from "../render/handOverlay";

// ----- Tunables -----

// Steering. Landmarks near the frame edges are the least reliable, so only
// the central band of the camera frame maps onto the board — the player
// never has to reach into the noisy edge region to hit column 0 or 11.
const STEER_X_MIN = 0.12;
const STEER_X_MAX = 0.88;
// Extra travel into a neighbouring cell (in column units) before the target
// column switches. Gives every cell boundary a dead zone so a hand hovering
// on a boundary can't flicker between two columns.
const COLUMN_DEAD_ZONE = 0.15;
// One Euro filter for the steering X — smooth at rest, snappy on fast moves.
const X_FILTER_MIN_CUTOFF = 1.2; // Hz
const X_FILTER_BETA = 1.5;

// Pinch (rotate)
const PINCH_THRESHOLD = 0.35; // normalized (pinchDist / handSize)
const PINCH_RELEASE = 0.5; // hysteresis: must open past this to clear pinch
const PINCH_ON_FRAMES = 2; // consecutive frames to confirm a pinch
const PINCH_OFF_FRAMES = 2; // consecutive frames to confirm a release
const PINCH_COOLDOWN_MS = 280;
const POST_PINCH_FREEZE_MS = 200;
// Light filtering only — pinch must stay low-latency; the frame debounce
// above does the heavy lifting against single-frame noise.
const PINCH_FILTER_MIN_CUTOFF = 3.0; // Hz
const PINCH_FILTER_BETA = 3.0;

// Drop zone — enter/exit bands plus a frame debounce, so a hand dipping near
// the line can't strobe the fast-fall on and off.
const DROP_Y_ENTER = 0.72;
const DROP_Y_EXIT = 0.62;
const DROP_ON_FRAMES = 3;

// Quality gating
// Frames where the model's hand score is below this are ignored entirely —
// better to coast on the last good state than steer off garbage landmarks.
const MIN_HAND_CONFIDENCE = 0.6;
// A dropout shorter than this keeps the last good gesture state alive, so a
// single missed detection doesn't reset pinch tracking or freeze movement.
const HAND_LOST_GRACE_MS = 250;

const FINGER_EXTENDED_MARGIN = 0.08; // fraction of hand size

// ----- Private rolling state — one tracker per page, so module-level is fine.

interface GestureRuntime {
  xFilter: OneEuroFilter;
  pinchFilter: OneEuroFilter;
  pinched: boolean;
  pinchOnStreak: number;
  pinchOffStreak: number;
  lastPinchTime: number;
  dropStreak: number;
  lastSeenMs: number; // last frame that passed the confidence gate
  lastFrameMs: number; // last results callback, for the fps estimate
}

function createRuntime(): GestureRuntime {
  return {
    xFilter: new OneEuroFilter(X_FILTER_MIN_CUTOFF, X_FILTER_BETA),
    pinchFilter: new OneEuroFilter(PINCH_FILTER_MIN_CUTOFF, PINCH_FILTER_BETA),
    pinched: false,
    pinchOnStreak: 0,
    pinchOffStreak: 0,
    lastPinchTime: 0,
    dropStreak: 0,
    lastSeenMs: 0,
    lastFrameMs: 0,
  };
}

let rt = createRuntime();

/** Clear all rolling gesture state — call when (re)booting the tracker. */
export function resetGestureTracking(): void {
  rt = createRuntime();
}

// Debug overlay flag — off by default, flipped by the D hotkey.
let debugOverlayEnabled = false;

export function toggleDebugOverlay(): boolean {
  debugOverlayEnabled = !debugOverlayEnabled;
  return debugOverlayEnabled;
}

export function onHandResults(
  results: Results,
  gestureRef: React.MutableRefObject<GestureState>,
  movementFreezeUntilRef: React.MutableRefObject<number>,
): void {
  const g = gestureRef.current;
  const now = performance.now();

  // Model throughput estimate (EMA over inter-result gaps).
  if (rt.lastFrameMs > 0) {
    const inst = 1000 / Math.max(1, now - rt.lastFrameMs);
    g.trackingFps = g.trackingFps === 0 ? inst : g.trackingFps * 0.9 + inst * 0.1;
  }
  rt.lastFrameMs = now;

  const handsLandmarks = results.multiHandLandmarks;
  const detected = !!handsLandmarks && handsLandmarks.length > 0;
  const confidence = detected
    ? (results.multiHandedness?.[0]?.score ?? 1)
    : 0;
  g.confidence = confidence;

  if (!detected || confidence < MIN_HAND_CONFIDENCE) {
    // Low-quality frame. Coast on the previous state through brief dropouts;
    // only after the grace window do we declare the hand gone and reset.
    if (now - rt.lastSeenMs > HAND_LOST_GRACE_MS) {
      g.handVisible = false;
      g.rawLandmarks = null;
      g.pinchActive = false;
      g.dropZoneActive = false;
      rt.pinched = false;
      rt.pinchOnStreak = 0;
      rt.pinchOffStreak = 0;
      rt.dropStreak = 0;
      rt.xFilter.reset();
      rt.pinchFilter.reset();
    }
    return;
  }
  rt.lastSeenMs = now;

  const lm = handsLandmarks[0] as HandLandmark[];
  g.handVisible = true;
  g.rawLandmarks = lm;

  // ---- X position → target column ----
  // Mirrored to match the flipped video, remapped from the active steering
  // band, then One-Euro-filtered to kill jitter without movement lag.
  const indexTip = lm[8];
  const mirroredX = 1 - indexTip.x;
  const steerX = clamp(
    (mirroredX - STEER_X_MIN) / (STEER_X_MAX - STEER_X_MIN),
    0,
    1,
  );
  const tSec = now / 1000;
  g.smoothedX = rt.xFilter.filter(steerX, tSec);

  const rawColumn = clamp(g.smoothedX * COLS, 0, COLS - 0.001);
  g.currentColumnFloat = rawColumn;
  // Commit a new column only once the hand is clearly inside it — the dead
  // zone is measured from the current cell's center so it's the same width
  // at every boundary.
  const center = g.targetColumn + 0.5;
  if (Math.abs(rawColumn - center) > 0.5 + COLUMN_DEAD_ZONE) {
    g.targetColumn = Math.max(0, Math.min(COLS - 1, Math.floor(rawColumn)));
  }

  // ---- Pinch (3D, hand-size-normalised) ----
  const thumbTip = lm[4];
  const wrist = lm[0];
  const middleBase = lm[9];
  const handSize = distance3(wrist, middleBase);
  const pinchDist = distance3(indexTip, thumbTip);
  const rawPinch = handSize > 0 ? pinchDist / handSize : 1;
  const normalizedPinch = rt.pinchFilter.filter(rawPinch, tSec);
  g.normalizedPinch = normalizedPinch;

  // Require the non-pinching fingers (middle, ring, pinky) to be extended.
  // A folded fist with thumb+index touching should NOT trigger a rotate.
  const handOpen =
    isFingerExtended(lm, 12, 10, wrist, handSize) &&
    isFingerExtended(lm, 16, 14, wrist, handSize) &&
    isFingerExtended(lm, 20, 18, wrist, handSize);

  // Debounced hysteresis: a pinch must hold for PINCH_ON_FRAMES consecutive
  // frames to register, and must clearly open (past PINCH_RELEASE) for
  // PINCH_OFF_FRAMES before it can re-trigger. The open-hand gate applies on
  // the way in only — an active pinch may hold even if other fingers wobble.
  if (!rt.pinched) {
    const closed = normalizedPinch < PINCH_THRESHOLD && handOpen;
    rt.pinchOnStreak = closed ? rt.pinchOnStreak + 1 : 0;
    if (rt.pinchOnStreak >= PINCH_ON_FRAMES) {
      rt.pinched = true;
      rt.pinchOffStreak = 0;
      // The cooldown swallows rapid re-fires: a pinch inside the window
      // still latches (so release tracking stays correct) but doesn't rotate.
      if (now - rt.lastPinchTime > PINCH_COOLDOWN_MS) {
        rt.lastPinchTime = now;
        g.pinchRisingEdge = true;
        movementFreezeUntilRef.current = now + POST_PINCH_FREEZE_MS;
      }
    }
  } else {
    const open = normalizedPinch > PINCH_RELEASE;
    rt.pinchOffStreak = open ? rt.pinchOffStreak + 1 : 0;
    if (rt.pinchOffStreak >= PINCH_OFF_FRAMES) {
      rt.pinched = false;
      rt.pinchOnStreak = 0;
    }
  }
  g.pinchActive = rt.pinched;

  // ---- Drop zone (enter/exit hysteresis + debounce) ----
  g.indexTipY = indexTip.y;
  if (g.dropZoneActive) {
    // Exiting early is harmless (the piece just slows down), so the exit
    // band alone is enough — no debounce needed on the way out.
    if (indexTip.y < DROP_Y_EXIT) {
      g.dropZoneActive = false;
      rt.dropStreak = 0;
    }
  } else {
    rt.dropStreak = indexTip.y > DROP_Y_ENTER ? rt.dropStreak + 1 : 0;
    if (rt.dropStreak >= DROP_ON_FRAMES) {
      g.dropZoneActive = true;
    }
  }
}

// ----- 2D overlay drawing loop -----

// Scratch object reused every frame the debug overlay is on.
const debugScratch: DebugDrawInfo = {
  confidence: 0,
  trackingFps: 0,
  smoothedX: 0,
  targetColumn: 0,
  indexTipY: 0,
  dropEnter: DROP_Y_ENTER,
  dropExit: DROP_Y_EXIT,
};

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
    let debug: DebugDrawInfo | null = null;
    if (debugOverlayEnabled) {
      debugScratch.confidence = g.confidence;
      debugScratch.trackingFps = g.trackingFps;
      debugScratch.smoothedX = g.smoothedX;
      debugScratch.targetColumn = g.targetColumn;
      debugScratch.indexTipY = g.indexTipY;
      debug = debugScratch;
    }
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
      debug,
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
  return tipToWrist > pipToWrist + FINGER_EXTENDED_MARGIN * handSize;
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
