"use client";

// Local, per-game practice history. No server, no auth — this is the player's
// private record of how their eye/hand is improving over time. Mirrors the
// defensive localStorage pattern in lib/leaderboard/local.ts.

const NS = "arcade/v1/progress/";

/** One completed round within a session. */
export interface RoundRecord {
  /** Challenge type key (game-defined, e.g. "bisect", "golden"). */
  type: string;
  /** Normalised error: 0 = perfect, 1 = as-bad-as-it-gets. */
  errorPct: number;
  points: number;
}

/** One completed session (a full run of a game). */
export interface SessionRecord {
  score: number;
  rounds: number;
  /** Mean error per challenge type over this session. */
  byType: Record<string, { avgError: number; count: number }>;
  at: number; // unix ms
}

const MAX_SESSIONS = 40;

function key(game: string): string {
  return `${NS}${game}`;
}

function safeGet(k: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(k) : null;
  } catch {
    return null;
  }
}

function safeSet(k: string, v: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(k, v);
  } catch {
    /* quota / private mode — ignore */
  }
}

export function loadSessions(game: string): SessionRecord[] {
  const raw = safeGet(key(game));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is SessionRecord =>
        s &&
        typeof s.score === "number" &&
        typeof s.rounds === "number" &&
        typeof s.at === "number" &&
        typeof s.byType === "object",
    );
  } catch {
    return [];
  }
}

/**
 * Fold a completed run's rounds into a session summary and persist it.
 * Returns the summary (handy for the game-over screen).
 */
export function recordSession(
  game: string,
  score: number,
  rounds: RoundRecord[],
): SessionRecord {
  const byType: SessionRecord["byType"] = {};
  for (const r of rounds) {
    const b = byType[r.type] ?? { avgError: 0, count: 0 };
    // running mean
    b.avgError = (b.avgError * b.count + r.errorPct) / (b.count + 1);
    b.count += 1;
    byType[r.type] = b;
  }
  const session: SessionRecord = {
    score,
    rounds: rounds.length,
    byType,
    at: Date.now(),
  };
  const all = loadSessions(game);
  all.push(session);
  // Keep the most recent MAX_SESSIONS.
  const trimmed = all.slice(-MAX_SESSIONS);
  safeSet(key(game), JSON.stringify(trimmed));
  return session;
}

/** Best (highest) session score to date, or 0. */
export function bestScore(game: string): number {
  return loadSessions(game).reduce((m, s) => Math.max(m, s.score), 0);
}

/** Recent session scores oldest→newest, for a trend sparkline. */
export function scoreTrend(game: string, limit = 12): number[] {
  return loadSessions(game)
    .slice(-limit)
    .map((s) => s.score);
}

/**
 * Rolling mean error per challenge type across recent sessions. Types with no
 * history are absent from the map (callers treat those as "explore me").
 */
export function typeAccuracy(
  game: string,
  recentSessions = 8,
): Record<string, number> {
  const sessions = loadSessions(game).slice(-recentSessions);
  const acc: Record<string, { sum: number; count: number }> = {};
  for (const s of sessions) {
    for (const [type, b] of Object.entries(s.byType)) {
      const a = acc[type] ?? { sum: 0, count: 0 };
      a.sum += b.avgError * b.count;
      a.count += b.count;
      acc[type] = a;
    }
  }
  const out: Record<string, number> = {};
  for (const [type, a] of Object.entries(acc)) {
    if (a.count > 0) out[type] = a.sum / a.count;
  }
  return out;
}
