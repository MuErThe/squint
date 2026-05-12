export interface HandLandmark {
  x: number;
  y: number;
  z?: number;
}

import { COLS } from "../tetris/types";

export interface GestureState {
  handVisible: boolean;
  smoothedX: number; // 0..1, mirrored to match visual
  targetColumn: number; // 0..COLS-1
  currentColumnFloat: number; // float column post-hysteresis
  pinchActive: boolean;
  pinchRisingEdge: boolean;
  dropZoneActive: boolean;
  normalizedPinch: number; // current pinch distance / hand size
  indexTipY: number; // 0..1 raw landmark Y (for drop-zone visualisation)
  rawLandmarks: HandLandmark[] | null;
}

export function initialGestureState(): GestureState {
  const mid = Math.floor(COLS / 2);
  return {
    handVisible: false,
    smoothedX: 0.5,
    targetColumn: mid,
    currentColumnFloat: mid,
    pinchActive: false,
    pinchRisingEdge: false,
    dropZoneActive: false,
    normalizedPinch: 1,
    indexTipY: 0,
    rawLandmarks: null,
  };
}
