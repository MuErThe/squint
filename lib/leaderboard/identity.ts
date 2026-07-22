"use client";

// Shared "resolve a player identity" flow for the mouse/touch games. Mirrors
// the inline logic in StartScreen (Tetris), factored out so every game's shell
// can reuse it: reuse a stored token when the name matches, otherwise reserve a
// fresh one (auto-generating on collisions), and fall back to a local-only
// identity when the leaderboard isn't configured.

import { reserveName } from "./api";
import { leaderboardConfigured } from "./supabase";
import { saveStoredPlayer, loadStoredPlayer, type StoredPlayer } from "./local";
import { validateName, nameValidationMessage, NAME_RULES } from "./profanity";
import { generateRandomName } from "./random-name";

export type ResolveResult =
  | { ok: true; player: StoredPlayer; name: string }
  | { ok: false; error: string; name: string };

/**
 * Resolve the player to submit under. `rawName` may be empty (auto-generates).
 * Never throws — failures come back as `{ ok: false, error }`.
 */
export async function resolveIdentity(rawName: string): Promise<ResolveResult> {
  let candidate = rawName.trim();
  if (!candidate) candidate = generateRandomName();

  const stored = loadStoredPlayer();
  if (stored && stored.name.toLowerCase() === candidate.toLowerCase()) {
    return { ok: true, player: stored, name: candidate };
  }

  const v = validateName(candidate);
  if (!v.ok) {
    return {
      ok: false,
      error: nameValidationMessage(v) ?? "invalid name",
      name: candidate,
    };
  }

  if (!leaderboardConfigured()) {
    const p: StoredPlayer = { name: candidate, token: "local" };
    saveStoredPlayer(p);
    return { ok: true, player: p, name: candidate };
  }

  let attempt = candidate;
  for (let i = 0; i < 4; i++) {
    const res = await reserveName(attempt);
    if (res.ok) {
      const p: StoredPlayer = { name: attempt, token: res.token };
      saveStoredPlayer(p);
      return { ok: true, player: p, name: attempt };
    }
    if (res.error === "name_taken") {
      if (i < 3) {
        attempt = generateRandomName();
        continue;
      }
      return {
        ok: false,
        error: `"${attempt}" is taken — try another`,
        name: attempt,
      };
    }
    return {
      ok: false,
      error:
        res.error === "name_profanity"
          ? "please pick a different name"
          : res.error === "name_length"
            ? `name must be ${NAME_RULES.min}–${NAME_RULES.max} characters`
            : res.error === "name_charset"
              ? "letters, digits, underscore and dash only"
              : res.error === "offline"
                ? "leaderboard is offline — playing locally"
                : `couldn't reserve name (${res.message ?? res.error})`,
      name: attempt,
    };
  }
  return { ok: false, error: "couldn't reserve a name", name: attempt };
}
