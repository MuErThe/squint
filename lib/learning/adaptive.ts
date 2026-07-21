// Adaptive round selection: bias practice toward the challenge types the
// player is worst at, so a session targets the gap instead of rehearsing
// strengths. Pure functions — the randomness is injected so callers stay
// deterministic where they need to be.

/**
 * Weighted pick over `types`, where a higher rolling error → higher weight.
 * Types absent from `accuracy` (never practised) get an exploration boost so
 * they still appear. A floor keeps every type reachable.
 *
 * @param accuracy  type → rolling mean error (0 good … 1 bad)
 * @param rand      a [0,1) source (defaults to Math.random)
 */
export function pickWeightedType<T extends string>(
  types: readonly T[],
  accuracy: Record<string, number>,
  rand: () => number = Math.random,
): T {
  if (types.length === 0) throw new Error("pickWeightedType: no types");
  const weights = types.map((t) => {
    const err = accuracy[t];
    // Unseen type → treat as high-error so we explore it.
    const base = err === undefined ? 0.6 : err;
    // Floor of 0.15 so a mastered type never fully disappears.
    return 0.15 + base * 2;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < types.length; i++) {
    r -= weights[i];
    if (r <= 0) return types[i];
  }
  return types[types.length - 1];
}

/**
 * Build a session's ordered list of challenge types. Weighted-random, but
 * avoids running the same type back-to-back where possible so the session
 * feels varied.
 */
export function buildSequence<T extends string>(
  types: readonly T[],
  accuracy: Record<string, number>,
  count: number,
  rand: () => number = Math.random,
): T[] {
  const seq: T[] = [];
  for (let i = 0; i < count; i++) {
    let pick = pickWeightedType(types, accuracy, rand);
    if (types.length > 1 && pick === seq[seq.length - 1]) {
      // One re-roll to reduce immediate repeats.
      pick = pickWeightedType(types, accuracy, rand);
    }
    seq.push(pick);
  }
  return seq;
}
