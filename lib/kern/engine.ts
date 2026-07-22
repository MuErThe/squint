// Kern Combat — pure helpers: pair classification, gap scoring, word picking.
// Font measurement (canvas) lives in the page since it needs the DOM.

import { GAP_TOLERANCE_EM, MAX_ROUND_POINTS, type KernCategory } from "./types";

// Letters whose relevant side is a diagonal or a big overhang — the pairs that
// must nest closer than they look.
const OPEN = new Set("AVWYTLFPKXvwyk".split(""));
// Letters built from curves — they carry their own optical space.
const ROUND = new Set("OQCGDoceqgbdp".split(""));
// Letters dominated by vertical stems — parallel sides read cramped fast.
const STRAIGHT = new Set("HILNMEFKRBUhilnmbku".split(""));

/** Classify the pair straddling a gap, for choosing the lesson. */
export function pairRule(a: string, b: string): KernCategory {
  // A diagonal/overhang beside anything is the classic "make it nest" problem.
  if (OPEN.has(a) || OPEN.has(b)) return "open";
  if (ROUND.has(a) && ROUND.has(b)) return "round";
  if (STRAIGHT.has(a) && STRAIGHT.has(b)) return "straight";
  return "mixed";
}

export interface GapScore {
  /** Mean normalised gap error, 0 (perfect) … 1. */
  errorPct: number;
  points: number;
  /** Index of the interior gap (1-based letter index) with the worst error. */
  worstGap: number;
  /** Signed sense of the worst gap: too wide or too tight. */
  worstTag: "wide" | "tight";
}

/**
 * Score a laid-out word. `actual`/`ideal` are cumulative left positions per
 * glyph in px (length n). `emPx` is the font size in px (the error unit).
 */
export function scoreGaps(
  actual: number[],
  ideal: number[],
  emPx: number,
): GapScore {
  const tolPx = emPx * GAP_TOLERANCE_EM;
  let sum = 0;
  let count = 0;
  let worstGap = 1;
  let worstErr = -1;
  let worstSigned = 0;
  for (let i = 1; i < actual.length; i++) {
    const actualGap = actual[i] - actual[i - 1];
    const idealGap = ideal[i] - ideal[i - 1];
    const signed = actualGap - idealGap; // + = too wide
    const err = Math.min(1, Math.abs(signed) / tolPx);
    sum += err;
    count += 1;
    if (err > worstErr) {
      worstErr = err;
      worstGap = i;
      worstSigned = signed;
    }
  }
  const errorPct = count > 0 ? sum / count : 0;
  return {
    errorPct,
    points: Math.max(0, Math.round(MAX_ROUND_POINTS * (1 - errorPct))),
    worstGap,
    worstTag: worstSigned >= 0 ? "wide" : "tight",
  };
}
