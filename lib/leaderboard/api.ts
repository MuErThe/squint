"use client";

import { getSupabase } from "./supabase";

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  /** Per-game stats blob (e.g. Tetris: { lines, level }). */
  meta: Record<string, unknown>;
  created_at: string;
}

/**
 * A derived column rendered from a row's `meta` blob. Each game supplies its
 * own set (Tetris → lines + level; an accuracy game → best round, etc.), so the
 * shared board UI stays game-agnostic.
 */
export interface MetaColumn {
  /** Header text (lowercase, short). */
  label: string;
  get: (meta: Record<string, unknown>) => number | string;
  /** Column width in px for the grid template (default 48). */
  width?: number;
}

export type ReserveError =
  | "offline"
  | "name_taken"
  | "name_length"
  | "name_charset"
  | "name_profanity"
  | "network"
  | "unknown";

export type ReserveResult =
  | { ok: true; token: string }
  | { ok: false; error: ReserveError; message?: string };

export type SubmitError =
  | "offline"
  | "rate_limited"
  | "bad_token"
  | "unknown_name"
  | "unknown_game"
  | "implausible_score"
  | "implausible_time"
  | "invalid_range"
  | "network"
  | "unknown";

export type SubmitResult =
  | { ok: true }
  | { ok: false; error: SubmitError; message?: string };

// Postgres exceptions raised by the RPC functions arrive as messages on
// `.error.message`. Pick out the lowercase tag if present.
function classify<T extends string>(message: string | undefined, tags: readonly T[]): T | "unknown" {
  if (!message) return "unknown";
  const m = message.toLowerCase();
  for (const t of tags) if (m.includes(t)) return t;
  return "unknown";
}

export async function reserveName(name: string): Promise<ReserveResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "offline" };
  try {
    const { data, error } = await sb.rpc("reserve_name", { p_name: name });
    if (error) {
      const tag = classify(error.message, [
        "name_taken",
        "name_length",
        "name_charset",
        "name_profanity",
      ] as const);
      return { ok: false, error: tag, message: error.message };
    }
    if (typeof data !== "string" || data.length === 0) {
      return { ok: false, error: "unknown", message: "no token returned" };
    }
    return { ok: true, token: data };
  } catch (e) {
    return {
      ok: false,
      error: "network",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

export interface SubmitArgs {
  name: string;
  token: string;
  /** Which game's board to write to (e.g. "tetris", "eyeball-it"). */
  game: string;
  score: number;
  /** Per-game stats persisted alongside the score. */
  meta?: Record<string, unknown>;
  playTimeMs: number;
}

export async function submitScore(args: SubmitArgs): Promise<SubmitResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "offline" };
  try {
    const { error } = await sb.rpc("submit_game_score", {
      p_name: args.name,
      p_token: args.token,
      p_game: args.game,
      p_score: Math.floor(args.score),
      p_meta: args.meta ?? {},
      p_play_time_ms: Math.floor(args.playTimeMs),
    });
    if (error) {
      const tag = classify(error.message, [
        "rate_limited",
        "bad_token",
        "unknown_name",
        "unknown_game",
        "implausible_score",
        "implausible_time",
        "invalid_range",
      ] as const);
      return { ok: false, error: tag, message: error.message };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: "network",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function fetchTop10(game: string): Promise<LeaderboardRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  // Over-fetch so that after collapsing duplicate runs per player we can still
  // surface a full top-10 of distinct entries.
  const { data, error } = await sb.rpc("top_game_scores", {
    p_game: game,
    p_limit: 50,
  });
  if (error || !Array.isArray(data)) return [];
  const rows = (data as Array<Partial<LeaderboardRow>>).map((r) => ({
    rank: Number(r.rank ?? 0),
    name: String(r.name ?? ""),
    score: Number(r.score ?? 0),
    meta: (r.meta as Record<string, unknown> | undefined) ?? {},
    created_at: String(r.created_at ?? ""),
  })) as LeaderboardRow[];

  // Two-pass dedup:
  //   1. Same case-insensitive name → keep the first sighting. Rows arrive
  //      sorted best-first, so first = that player's best run.
  //   2. Same (score, meta) tuple → keep the most recent. Catches the case
  //      where a player registered under more than one spelling and ran the
  //      exact same stats — only the latest record survives.
  const byName = new Map<string, LeaderboardRow>();
  for (const r of rows) {
    const key = (r.name ?? "").toLowerCase();
    if (!byName.has(key)) byName.set(key, r);
  }

  const byStats = new Map<string, LeaderboardRow>();
  for (const r of byName.values()) {
    const key = `${r.score}|${JSON.stringify(r.meta)}`;
    const prev = byStats.get(key);
    if (
      !prev ||
      new Date(r.created_at).getTime() > new Date(prev.created_at).getTime()
    ) {
      byStats.set(key, r);
    }
  }

  return Array.from(byStats.values())
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 10)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
