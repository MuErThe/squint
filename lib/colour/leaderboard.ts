import type { MetaColumn } from "@/lib/leaderboard/api";

/** Board identifier for Colour Forge scores (must match the server whitelist). */
export const COLOUR_GAME = "colour-forge";

/** Extra board columns derived from a Colour Forge score's `meta` blob. */
export const COLOUR_COLUMNS: MetaColumn[] = [
  { label: "acc", get: (m) => `${Number(m.acc ?? 0)}%`, width: 44 },
  { label: "ΔE", get: (m) => Number(m.avgDe ?? 0), width: 40 },
];
