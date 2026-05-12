export interface HandLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface GestureState {
  handVisible: boolean;
  smoothedX: number; // 0..1, mirrored to match visual
  targetColumn: number; // 0..9
  currentColumnFloat: number; // float column post-hysteresis
  pinchActive: boolean;
  pinchRisingEdge: boolean;
  dropZoneActive: boolean;
  normalizedPinch: number; // current pinch distance / hand size
  indexTipY: number; // 0..1 raw landmark Y (for drop-zone visualisation)
  rawLandmarks: HandLandmark[] | null;
}

export function initialGestureState(): GestureState {
  return {
    handVisible: false,
    smoothedX: 0.5,
    targetColumn: 4,
    currentColumnFloat: 4,
    pinchActive: false,
    pinchRisingEdge: false,
    dropZoneActive: false,
    normalizedPinch: 1,
    indexTipY: 0,
    rawLandmarks: null,
  };
}
