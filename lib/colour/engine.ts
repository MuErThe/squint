// Colour Forge — pure round generation + scoring. Player mixes in HSL; scoring
// is CIEDE2000 in Lab; the channel breakdown is reported back in HSL terms so
// the lesson is "you over-saturated" not "your b* was off".

import { deltaE2000, hslToLab, hueDelta, type Hsl } from "./space";

export type ColourRoundType = "match" | "memory" | "complement";

export const COLOUR_TYPES: ColourRoundType[] = ["match", "memory", "complement"];

export const TYPE_LABEL: Record<ColourRoundType, string> = {
  match: "MATCH",
  memory: "MEMORY",
  complement: "COMPLEMENT",
};

export interface ColourRound {
  type: ColourRoundType;
  /** The colour the player must produce. */
  target: Hsl;
  /** For "complement": the base colour shown (target is its complement). */
  base?: Hsl;
}

export const ROUNDS_PER_SESSION = 8;
export const MAX_ROUND_POINTS = 1000;
/** A CIEDE2000 difference this large scores zero. */
export const DELTAE_TOLERANCE = 45;

const rnd = (min: number, max: number) => min + Math.random() * (max - min);

/** A pleasant, matchable colour — avoid near-black/white and muddy extremes. */
function randomColour(): Hsl {
  return {
    h: Math.round(rnd(0, 360)),
    s: Math.round(rnd(38, 92)),
    l: Math.round(rnd(32, 72)),
  };
}

export function generate(type: ColourRoundType): ColourRound {
  if (type === "complement") {
    const base = randomColour();
    return { type, base, target: { h: (base.h + 180) % 360, s: base.s, l: base.l } };
  }
  return { type, target: randomColour() };
}

export type ColourAxis = "hue" | "saturation" | "lightness" | "balanced";

export interface ColourEval {
  deltaE: number;
  errorPct: number;
  points: number;
  axis: ColourAxis;
  /** Direction tag for lesson lookup. */
  dir: string;
  /** Human breakdown, e.g. "hue +8° · sat +12 · light −4". */
  breakdown: string;
}

export function evaluate(round: ColourRound, attempt: Hsl): ColourEval {
  const dE = deltaE2000(hslToLab(round.target), hslToLab(attempt));
  const errorPct = Math.min(1, dE / DELTAE_TOLERANCE);
  const points = Math.max(0, Math.round(MAX_ROUND_POINTS * (1 - errorPct)));

  const dh = hueDelta(round.target.h, attempt.h); // attempt − target, −180..180
  const ds = attempt.s - round.target.s;
  const dl = attempt.l - round.target.l;

  const sign = (n: number) => (n > 0 ? "+" : "");
  const breakdown = `hue ${sign(dh)}${Math.round(dh)}° · sat ${sign(ds)}${Math.round(
    ds,
  )} · light ${sign(dl)}${Math.round(dl)}`;

  // Which axis dominates the miss? Normalise each by a "just noticeable" scale.
  const hueMag = Math.abs(dh) / 25;
  const satMag = Math.abs(ds) / 14;
  const lightMag = Math.abs(dl) / 14;
  const maxMag = Math.max(hueMag, satMag, lightMag);

  let axis: ColourAxis = "balanced";
  let dir = "_default";
  if (dE >= 6 && maxMag > 0.4) {
    if (maxMag === hueMag) {
      axis = "hue";
      dir = "off";
    } else if (maxMag === satMag) {
      axis = "saturation";
      dir = ds > 0 ? "over" : "under";
    } else {
      axis = "lightness";
      dir = dl > 0 ? "over" : "under";
    }
  }

  return { deltaE: dE, errorPct, points, axis, dir, breakdown };
}
