// Eyeball It — pure generators + scoring. No React, no DOM.

import {
  type AngleChallenge,
  type Challenge,
  type Evaluation,
  type EyeballType,
  type Guess,
  type LinearChallenge,
  type PointChallenge,
  MAX_ROUND_POINTS,
} from "./types";

const GOLDEN = 0.618;
/** Optical centre sits ~3% above geometric to *look* centred. */
const OPTICAL_OFFSET = 0.03;

const LINEAR_TOL = 0.12;
const POINT_TOL = 0.14;
const ANGLE_TOL = 18; // degrees

function rand(): number {
  return Math.random();
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Generate a fresh, randomised challenge of the given type. */
export function generate(type: EyeballType): Challenge {
  switch (type) {
    case "bisect": {
      const axis = pick(["x", "y"] as const);
      return {
        kind: "linear",
        type,
        axis,
        target: 0.5,
        tol: LINEAR_TOL,
        prompt:
          axis === "x"
            ? "Mark the exact middle of the line."
            : "Mark the exact middle of the column.",
      } satisfies LinearChallenge;
    }
    case "thirds": {
      const axis = pick(["x", "y"] as const);
      // Always the near third to keep the target unambiguous.
      return {
        kind: "linear",
        type,
        axis,
        target: 1 / 3,
        tol: LINEAR_TOL,
        prompt:
          axis === "x"
            ? "Place the line one third of the way from the left."
            : "Place the line one third of the way from the top.",
      } satisfies LinearChallenge;
    }
    case "golden": {
      const axis = pick(["x", "y"] as const);
      return {
        kind: "linear",
        type,
        axis,
        target: GOLDEN,
        tol: LINEAR_TOL,
        prompt: "Place the line at the golden section.",
      } satisfies LinearChallenge;
    }
    case "optical-centre": {
      return {
        kind: "linear",
        type,
        axis: "y",
        target: 0.5 - OPTICAL_OFFSET,
        geometric: 0.5,
        tol: LINEAR_TOL,
        prompt: "Split the frame so it *looks* even — trust your eye, not a ruler.",
      } satisfies LinearChallenge;
    }
    case "centre": {
      // Random box within the play area; centre the dot in it.
      const w = 0.4 + rand() * 0.35;
      const h = 0.4 + rand() * 0.35;
      const x = (1 - w) * rand();
      const y = (1 - h) * rand();
      return {
        kind: "point",
        type,
        box: { x, y, w, h },
        target: { x: x + w / 2, y: y + h / 2 },
        tol: POINT_TOL,
        prompt: "Drop the dot dead-centre in the frame.",
      } satisfies PointChallenge;
    }
    case "angle": {
      const targetDeg = pick([30, 45, 60, 90, 120, 135]);
      return {
        kind: "angle",
        type,
        targetDeg,
        pivot: { x: 0.28, y: 0.62 },
        tol: ANGLE_TOL,
        prompt: `Set the arm to ${targetDeg}° from the baseline.`,
      } satisfies AngleChallenge;
    }
  }
}

function pointsFor(errorPct: number): number {
  // Linear falloff to zero at the tolerance edge.
  return Math.max(0, Math.round(MAX_ROUND_POINTS * (1 - errorPct)));
}

/** Score a guess against a challenge and produce reveal metadata. */
export function evaluate(challenge: Challenge, guess: Guess): Evaluation {
  if (challenge.kind === "linear" && guess.kind === "linear") {
    const raw = Math.abs(guess.value - challenge.target);
    const errorPct = Math.min(1, raw / challenge.tol);
    let tag: string;
    if (challenge.type === "optical-centre") {
      // Above/below the *optical* target, framed as the teaching moment.
      tag =
        guess.value >= challenge.target + 0.02
          ? "geometric-trap"
          : guess.value <= challenge.target - 0.03
            ? "over-corrected"
            : "_default";
    } else {
      tag = guess.value > challenge.target ? "over" : "under";
    }
    return {
      errorPct,
      points: pointsFor(errorPct),
      tag,
      guessDisplay: guess.value.toFixed(2),
      targetDisplay: challenge.target.toFixed(2),
      errorDisplay: fmtPct(raw),
    };
  }

  if (challenge.kind === "point" && guess.kind === "point") {
    const dx = guess.x - challenge.target.x;
    const dy = guess.y - challenge.target.y;
    const raw = Math.hypot(dx, dy);
    const errorPct = Math.min(1, raw / challenge.tol);
    return {
      errorPct,
      points: pointsFor(errorPct),
      tag: "off",
      guessDisplay: `${guess.x.toFixed(2)}, ${guess.y.toFixed(2)}`,
      targetDisplay: `${challenge.target.x.toFixed(2)}, ${challenge.target.y.toFixed(2)}`,
      errorDisplay: fmtPct(raw),
    };
  }

  if (challenge.kind === "angle" && guess.kind === "angle") {
    const raw = Math.abs(guess.deg - challenge.targetDeg);
    const errorPct = Math.min(1, raw / challenge.tol);
    const tag = guess.deg > challenge.targetDeg ? "steep" : "shallow";
    return {
      errorPct,
      points: pointsFor(errorPct),
      tag,
      guessDisplay: `${Math.round(guess.deg)}°`,
      targetDisplay: `${challenge.targetDeg}°`,
      errorDisplay: `${Math.round(raw)}°`,
    };
  }

  // Kind mismatch — shouldn't happen; score as a miss.
  return {
    errorPct: 1,
    points: 0,
    tag: "_default",
    guessDisplay: "—",
    targetDisplay: "—",
    errorDisplay: "—",
  };
}
