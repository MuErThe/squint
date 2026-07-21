import type { MetaColumn } from "@/lib/leaderboard/api";

/** Board identifier for Eyeball It scores (must match the server whitelist). */
export const EYEBALL_GAME = "eyeball-it";

/** Extra board columns derived from an Eyeball It score's `meta` blob. */
export const EYEBALL_COLUMNS: MetaColumn[] = [
  { label: "acc", get: (m) => `${Number(m.acc ?? 0)}%`, width: 44 },
  { label: "best", get: (m) => Number(m.best ?? 0) },
];
