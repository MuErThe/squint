import type { MetaColumn } from "@/lib/leaderboard/api";

/** Board identifier for Tetris scores. */
export const TETRIS_GAME = "tetris";

/** Extra board columns derived from a Tetris score's `meta` blob. */
export const TETRIS_COLUMNS: MetaColumn[] = [
  { label: "lines", get: (m) => Number(m.lines ?? 0) },
  { label: "lvl", get: (m) => Number(m.level ?? 1) },
];
