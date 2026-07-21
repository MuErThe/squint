// Kern Combat — space the letters by eye until they feel even, then grade the
// result against the font's own kerned metrics (measured at runtime). Each word
// is tagged with the optical rule its trickiest pairs exercise, so practice can
// lean toward the rule a player keeps missing.

export type KernCategory = "open" | "round" | "straight" | "mixed";

export const KERN_CATEGORIES: KernCategory[] = [
  "open",
  "round",
  "straight",
  "mixed",
];

export interface KernWord {
  text: string;
  /** The optical rule this word mainly drills. */
  category: KernCategory;
}

// Curated so each category has words with genuinely awkward pairs.
export const WORDS: KernWord[] = [
  // Open pairs (diagonals / overhangs that must nest: AV, WA, YA, To, LT…)
  { text: "AVIATOR", category: "open" },
  { text: "WAVE", category: "open" },
  { text: "YACHT", category: "open" },
  { text: "LATELY", category: "open" },
  { text: "VOYAGE", category: "open" },
  { text: "TYPeface", category: "open" },
  // Round pairs (curves that already carry their own air: OO, OC, GO…)
  { text: "COCOA", category: "round" },
  { text: "GLOBE", category: "round" },
  { text: "OCEAN", category: "round" },
  { text: "BLOOM", category: "round" },
  // Straight pairs (parallel stems that read cramped: HI, IL, NM, MU…)
  { text: "MUSEUM", category: "straight" },
  { text: "MILLION", category: "straight" },
  { text: "UNTIL", category: "straight" },
  { text: "FILTER", category: "straight" },
  // Mixed — real words, mixed shapes, judge the overall rhythm.
  { text: "DESIGN", category: "mixed" },
  { text: "STUDIO", category: "mixed" },
  { text: "KERNING", category: "mixed" },
  { text: "GRAPHIC", category: "mixed" },
];

export const ROUNDS_PER_SESSION = 6;
export const MAX_ROUND_POINTS = 1000;
/** A gap this far (in ems) from ideal scores zero. */
export const GAP_TOLERANCE_EM = 0.22;
