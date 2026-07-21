import type { MetaColumn } from "@/lib/leaderboard/api";

/** Board identifier for Kern Combat scores (must match the server whitelist). */
export const KERN_GAME = "kern-combat";

/** Extra board columns derived from a Kern Combat score's `meta` blob. */
export const KERN_COLUMNS: MetaColumn[] = [
  { label: "acc", get: (m) => `${Number(m.acc ?? 0)}%`, width: 44 },
  { label: "words", get: (m) => Number(m.words ?? 0) },
];
