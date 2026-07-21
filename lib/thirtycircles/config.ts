// Thirty Circles — the IDEO / Bob McKim divergent-thinking warm-up. Turn each
// of thirty identical circles into a different thing against the clock. There's
// no score and no leaderboard: the payoff is noticing your own default patterns.

export const THIRTY_GAME = "thirty-circles";

export const GRID_COLS = 6;
export const GRID_ROWS = 5;
export const TOTAL_CIRCLES = GRID_COLS * GRID_ROWS; // 30

export const DURATION_MS = 180_000; // 3 minutes

/**
 * Torrance's three dimensions of divergent thinking, surfaced one per session
 * as a reflection prompt — the point is to make you *see* your habits.
 */
export const REFLECTION_PROMPTS: string[] = [
  "Which one would nobody else in the room have drawn?", // originality
  "Which category did you never touch — faces, food, nature, machines?", // flexibility
  "Where did you get stuck, and what broke the block?", // fluency
  "Which idea surprised you as your hand was already drawing it?", // originality
  "Did you repeat a shape? What's the version you didn't let yourself draw?", // flexibility
];

/** Rough categories for the flexibility self-check. */
export const CATEGORIES = [
  "faces",
  "food",
  "nature",
  "objects",
  "machines",
  "symbols",
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Constraints for a "go again" run — a self-imposed limit is the classic way
 * to break out of a rut. One is chosen based on what you leaned on last time.
 */
export const CONSTRAINTS: string[] = [
  "no faces this time",
  "nothing with a screen",
  "only things that move",
  "only things smaller than your hand",
  "no food",
  "each one from a different decade",
];
