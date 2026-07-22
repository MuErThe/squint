"use client";

// localStorage-backed personal record + remembered credentials.

// Legacy namespace from before the Squint rename — deliberately unchanged:
// renaming it would orphan every existing player's stored token, locking them
// out of the leaderboard name they registered.
const NS = "hand-tetris/v1/";
const K_PLAYER = `${NS}player`;
const K_BEST = `${NS}best`;

export interface StoredPlayer {
  name: string;
  token: string;
}

export interface StoredBest {
  score: number;
  lines: number;
  level: number;
  at: number; // unix ms
}

function safeGet(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — ignore */
  }
}

function safeRemove(key: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadStoredPlayer(): StoredPlayer | null {
  const raw = safeGet(K_PLAYER);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPlayer>;
    if (
      typeof parsed?.name === "string" &&
      typeof parsed?.token === "string" &&
      parsed.name.length > 0 &&
      parsed.token.length > 0
    ) {
      return { name: parsed.name, token: parsed.token };
    }
  } catch {
    /* corrupted */
  }
  return null;
}

export function saveStoredPlayer(p: StoredPlayer): void {
  safeSet(K_PLAYER, JSON.stringify(p));
}

export function clearStoredPlayer(): void {
  safeRemove(K_PLAYER);
}

export function loadBest(): StoredBest | null {
  const raw = safeGet(K_BEST);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredBest>;
    if (
      typeof parsed?.score === "number" &&
      typeof parsed?.lines === "number" &&
      typeof parsed?.level === "number" &&
      typeof parsed?.at === "number"
    ) {
      return parsed as StoredBest;
    }
  } catch {
    /* corrupted */
  }
  return null;
}

/** Returns the new best if it was an improvement, otherwise null. */
export function maybeUpdateBest(candidate: StoredBest): StoredBest | null {
  const current = loadBest();
  if (current && candidate.score <= current.score) return null;
  safeSet(K_BEST, JSON.stringify(candidate));
  return candidate;
}
