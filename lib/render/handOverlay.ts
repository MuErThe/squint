"use client";

import type { HandLandmark } from "../hand/types";

// MediaPipe hand connections (21 landmarks, 21 connections in the standard skeleton).
// Subset/clone of @mediapipe/hands HAND_CONNECTIONS so we don't pull the library
// just for a constant.
export const HAND_CONNECTIONS: ReadonlyArray<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],         // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],         // index
  [5, 9], [9, 10], [10, 11], [11, 12],    // middle
  [9, 13], [13, 14], [14, 15], [15, 16],  // ring
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20], // pinky
];

const FINGERTIPS = [4, 8, 12, 16, 20] as const;

const THEME = {
  accent: "#f5b651",
  accentHot: "#ff7849",
  inkDim: "#8a8398",
  inkFaint: "rgba(245, 182, 81, 0.45)",
};

export interface OverlayDotState {
  /** Animated radii per fingertip landmark index. */
  radii: Map<number, number>;
  /** Last seen tick (ms) per landmark — older dots fade out. */
  lastSeen: Map<number, number>;
  /** Skeleton alpha — fades when hand disappears. */
  skeletonAlpha: number;
}

export function createOverlayState(): OverlayDotState {
  return {
    radii: new Map(),
    lastSeen: new Map(),
    skeletonAlpha: 0,
  };
}

/**
 * Rectangle on the canvas where the video is actually rendered. Lets us
 * letterbox via `object-fit: contain` without misaligning landmarks.
 */
export interface VideoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DrawArgs {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** The visible video rect inside the canvas (may be letterboxed). */
  videoRect: VideoRect;
  landmarks: HandLandmark[] | null;
  normalizedPinch: number;
  dropZoneActive: boolean;
  pinchActive: boolean;
  state: OverlayDotState;
}

export function drawHandOverlay({
  ctx,
  width,
  height,
  videoRect,
  landmarks,
  normalizedPinch,
  dropZoneActive,
  pinchActive,
  state,
}: DrawArgs) {
  ctx.clearRect(0, 0, width, height);

  // Drop zone dashed line at y = 0.70 OF THE VIDEO rect, not the canvas.
  // (Landmark y is normalised to the video frame.)
  const dropY = videoRect.y + videoRect.h * 0.7;
  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = dropZoneActive ? THEME.accentHot : THEME.inkFaint;
  ctx.beginPath();
  ctx.moveTo(videoRect.x, dropY);
  ctx.lineTo(videoRect.x + videoRect.w, dropY);
  ctx.stroke();
  ctx.restore();

  // Target skeleton alpha — fades as hand disappears
  const targetSkelAlpha = landmarks ? 1 : 0;
  state.skeletonAlpha = lerp(state.skeletonAlpha, targetSkelAlpha, 0.18);

  if (state.skeletonAlpha < 0.02 && !landmarks) {
    // Nothing more to draw
    return;
  }

  // Compute pixel positions inside the visible video rect.
  const pts = landmarks
    ? landmarks.map((l) => ({
        x: videoRect.x + l.x * videoRect.w,
        y: videoRect.y + l.y * videoRect.h,
      }))
    : null;

  if (pts) {
    // Skeleton lines
    ctx.save();
    ctx.globalAlpha = state.skeletonAlpha;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = THEME.accent;
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
    }
    ctx.stroke();
    ctx.restore();

    // Pinch line between thumb (4) and index (8)
    ctx.save();
    ctx.globalAlpha = state.skeletonAlpha;
    ctx.lineWidth = pinchActive ? 3 : 2;
    ctx.strokeStyle = pinchActive ? THEME.accentHot : THEME.inkFaint;
    ctx.beginPath();
    ctx.moveTo(pts[4].x, pts[4].y);
    ctx.lineTo(pts[8].x, pts[8].y);
    ctx.stroke();
    ctx.restore();
  }

  // Animated fingertip dots
  const now = performance.now();
  for (const idx of FINGERTIPS) {
    const pt = pts ? pts[idx] : null;
    if (pt) state.lastSeen.set(idx, now);
    const seen = state.lastSeen.get(idx) ?? 0;
    const ageMs = now - seen;
    if (!pt && ageMs > 600) continue; // fully faded

    // Target radius
    let target = 4;
    if (idx === 4 || idx === 8) {
      // Closer pinch -> bigger dot, clamped 4..12
      const closeness = clamp01(1 - normalizedPinch / 0.55);
      target = 4 + closeness * 8;
    }
    const prev = state.radii.get(idx) ?? target;
    const r = lerp(prev, pt ? target : 0, 0.3);
    state.radii.set(idx, r);

    if (r < 0.5) continue;

    // Color
    let color = THEME.accent;
    if (idx === 8 && dropZoneActive) color = THEME.accentHot;
    if ((idx === 4 || idx === 8) && pinchActive) color = THEME.accentHot;

    // Position: when no current point but still animating, use last position
    // by re-using the in-state radius (we don't store position history; fall back
    // to fading via radius shrinking).
    if (!pt) continue;

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Inner highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(pt.x - r * 0.25, pt.y - r * 0.3, Math.max(1, r * 0.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
