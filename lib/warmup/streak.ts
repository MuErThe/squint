"use client";

// Daily warm-up streak. Calendar-day based in the player's local timezone, with
// one grace day so a single missed day doesn't reset the count. Local-only.

const KEY = "arcade/v1/warmup-streak";

interface StreakData {
  count: number;
  lastDay: number; // local day number (days since epoch, local midnight)
}

/** Days since the Unix epoch at the given date's LOCAL midnight. */
function localDayNumber(d = new Date()): number {
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(midnight.getTime() / 86_400_000);
}

function load(): StreakData | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.count === "number" && typeof p?.lastDay === "number") return p;
  } catch {
    /* ignore */
  }
  return null;
}

function save(d: StreakData): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

/**
 * The streak as it stands today: the stored count if it's still alive (played
 * today, yesterday, or within the one grace day), otherwise 0.
 */
export function currentStreak(): number {
  const s = load();
  if (!s) return 0;
  const gap = localDayNumber() - s.lastDay;
  return gap <= 2 ? s.count : 0;
}

/** True if today's warm-up is already done. */
export function doneToday(): boolean {
  const s = load();
  return !!s && s.lastDay === localDayNumber();
}

/**
 * Record that today's warm-up is complete and return the new streak count.
 * Idempotent within a day.
 */
export function recordToday(): number {
  const today = localDayNumber();
  const s = load();
  if (!s) {
    save({ count: 1, lastDay: today });
    return 1;
  }
  if (s.lastDay === today) return s.count;
  const gap = today - s.lastDay;
  // gap 1 = yesterday, gap 2 = one missed day (forgiven). Otherwise reset.
  const count = gap === 1 || gap === 2 ? s.count + 1 : 1;
  save({ count, lastDay: today });
  return count;
}
