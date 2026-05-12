"use client";

import { getSupabase } from "./supabase";

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  lines: number;
  level: number;
  created_at: string;
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
  score: number;
  lines: number;
  level: number;
  playTimeMs: number;
}

export async function submitScore(args: SubmitArgs): Promise<SubmitResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "offline" };
  try {
    const { error } = await sb.rpc("submit_score", {
      p_name: args.name,
      p_token: args.token,
      p_score: Math.floor(args.score),
      p_lines: Math.floor(args.lines),
      p_level: Math.floor(args.level),
      p_play_time_ms: Math.floor(args.playTimeMs),
    });
    if (error) {
      const tag = classify(error.message, [
        "rate_limited",
        "bad_token",
        "unknown_name",
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

export async function fetchTop10(): Promise<LeaderboardRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  // Over-fetch so that after collapsing duplicate runs per player we can still
  // surface a full top-10 of distinct entries.
  const { data, error } = await sb.rpc("top_scores", { p_limit: 50 });
  if (error || !Array.isArray(data)) return [];
  const rows = data as LeaderboardRow[];

  // Two-pass dedup:
  //   1. Same case-insensitive name → keep the first sighting. Rows arrive
  //      sorted best-first, so first = that player's best run.
  //   2. Same (score, lines, level) tuple → keep the most recent. Catches the
  //      case where a player registered under more than one spelling and ran
  //      the exact same stats — only the latest record survives.
  const byName = new Map<string, LeaderboardRow>();
  for (const r of rows) {
    const key = (r.name ?? "").toLowerCase();
    if (!byName.has(key)) byName.set(key, r);
  }

  const byStats = new Map<string, LeaderboardRow>();
  for (const r of byName.values()) {
    const key = `${r.score}|${r.lines}|${r.level}`;
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
