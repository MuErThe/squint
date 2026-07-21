// Eyeball It — train the designer's eye. Each challenge type is a distinct
// "trained eye" skill with a crisp, defensible target so scoring is objective.
// All geometry is normalised to a 0..1 play area (y = 0 top, y = 1 bottom).

export type EyeballType =
  | "bisect" // find the exact midpoint of a line
  | "thirds" // place a line one third of the way in
  | "golden" // place a line at the golden section (0.618)
  | "centre" // drop a dot dead-centre in a frame
  | "angle" // set a ray to a target angle
  | "optical-centre"; // place a line where it *looks* centred (above geometric)

export const EYEBALL_TYPES: EyeballType[] = [
  "bisect",
  "thirds",
  "golden",
  "centre",
  "angle",
  "optical-centre",
];

export const TYPE_LABEL: Record<EyeballType, string> = {
  bisect: "BISECT",
  thirds: "THIRDS",
  golden: "GOLDEN",
  centre: "CENTRE",
  angle: "ANGLE",
  "optical-centre": "OPTICAL",
};

export interface LinearChallenge {
  kind: "linear";
  type: "bisect" | "thirds" | "golden" | "optical-centre";
  prompt: string;
  axis: "x" | "y";
  /** True answer, 0..1 along the axis. */
  target: number;
  /** optical-centre: also reveal the geometric middle (0.5) to teach the gap. */
  geometric?: number;
  /** Raw-error tolerance beyond which the round scores zero. */
  tol: number;
}

export interface PointChallenge {
  kind: "point";
  type: "centre";
  prompt: string;
  /** True centre, 0..1 play-area coords. */
  target: { x: number; y: number };
  /** The frame the dot must be centred in, normalised. */
  box: { x: number; y: number; w: number; h: number };
  tol: number;
}

export interface AngleChallenge {
  kind: "angle";
  type: "angle";
  prompt: string;
  /** Target angle in degrees, CCW from the horizontal baseline (+x). */
  targetDeg: number;
  /** Pivot point, 0..1 play-area coords. */
  pivot: { x: number; y: number };
  /** Tolerance in degrees. */
  tol: number;
}

export type Challenge = LinearChallenge | PointChallenge | AngleChallenge;

export type Guess =
  | { kind: "linear"; value: number }
  | { kind: "point"; x: number; y: number }
  | { kind: "angle"; deg: number };

export interface Evaluation {
  /** Normalised error, 0 = perfect … 1 = at/over tolerance. */
  errorPct: number;
  /** Round points, 0..1000. */
  points: number;
  /** Mistake tag for lesson lookup. */
  tag: string;
  guessDisplay: string;
  targetDisplay: string;
  errorDisplay: string;
}

export const ROUNDS_PER_SESSION = 10;
export const MAX_ROUND_POINTS = 1000;
