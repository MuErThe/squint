// Micro-lessons: one-line design principles surfaced in the round reveal,
// chosen to match the mistake the player just made. The reveal is the lesson;
// the score is only the motivation.
//
// Shape: LESSONS[game][type] holds a `_default` list plus per-mistake-tag
// lists. Each value is an array so we can offer light variety and avoid
// repeating the exact same wording twice in one session.

type TagLessons = Record<string, string[]>;
type GameLessons = Record<string, TagLessons>;

const LESSONS: Record<string, GameLessons> = {
  "eyeball-it": {
    bisect: {
      _default: [
        "The midpoint is exactly halfway — most eyes drift toward the busier end.",
      ],
      over: ["You went past halfway — the true middle is nearer than it looks from the long side."],
      under: ["Short of halfway — the eye tends to stop early on the approach."],
    },
    thirds: {
      _default: [
        "The rule of thirds puts the line a third of the way in — off-centre on purpose.",
      ],
      over: ["Too far in. A third sits nearer the edge than the middle."],
      under: ["Not far enough — a third still stands well clear of the edge."],
    },
    golden: {
      _default: [
        "The golden section lands at 0.618 — past a half, short of two-thirds.",
      ],
      over: ["You drifted toward two-thirds; the golden point is a touch tighter."],
      under: ["You leaned toward the half; the golden point sits a little further out."],
    },
    centre: {
      _default: [
        "Dead centre means equal on all four sides — check the gaps, not the shape.",
      ],
      off: ["Trust the gaps: equal margins beat 'looks about right'."],
    },
    angle: {
      _default: [
        "Judge angles against the horizon and vertical — not the neighbouring line.",
      ],
      steep: ["Steeper than the target — the eye exaggerates angles near vertical."],
      shallow: ["Shallower than the target — small angles read flatter than they are."],
    },
    "optical-centre": {
      _default: [
        "To look centred, an element sits slightly ABOVE the mathematical middle.",
      ],
      "geometric-trap": ["Geometry lies: the true middle looks low. Nudge up ~2–4%."],
      "over-corrected": ["Eased up too far — optical centre is only a hair above geometric."],
    },
  },
  "kern-combat": {
    open: {
      _default: ["Open pairs like AV or To overlap — let the shapes nest under each other."],
      wide: ["Too airy — diagonals and overhangs should tuck in tighter than they look."],
      tight: ["Nicely nested — open pairs want to overlap their bounding boxes."],
    },
    round: {
      _default: ["Curves carry their own space — round-to-round tucks in tight."],
      wide: ["Rounds drifted apart — curves need less air than flat sides."],
      tight: ["Good — but don't crush the curves; leave the counters breathing."],
    },
    straight: {
      _default: ["Parallel stems need real air — straight sides read cramped fast."],
      tight: ["Too cramped — give parallel stems room or they fuse into a wall."],
      wide: ["A hair wide — straights want air, but keep the rhythm even."],
    },
    mixed: {
      _default: ["Chase an even rhythm — every gap should feel the same weight."],
      wide: ["This gap runs wider than its neighbours — close it to match."],
      tight: ["This gap is tighter than the rest — open it to keep the rhythm."],
    },
  },
  "colour-forge": {
    saturation: {
      over: ["Most eyes over-saturate — real colours are greyer than they feel."],
      under: ["A touch flat — the rarer miss. Nudge the chroma up to meet it."],
    },
    hue: {
      off: ["Hue errors shout louder than lightness — lock the hue in first."],
    },
    lightness: {
      over: ["Reads too light — squint and match the value before the colour."],
      under: ["Reads too dark — squint; get the value right, then the colour."],
    },
    balanced: {
      _default: ["Close on every axis — butt the two edges together to catch the last of it."],
    },
  },
};

/**
 * Pick a lesson for a mistake. `seen` is a session-scoped set of already-shown
 * lines; we prefer an unseen one so the same wording doesn't recur twice.
 */
export function pickLesson(
  game: string,
  type: string,
  tag: string,
  seen?: Set<string>,
): string {
  const table = LESSONS[game]?.[type];
  if (!table) return "";
  const candidates = [...(table[tag] ?? []), ...(table._default ?? [])];
  if (candidates.length === 0) return "";
  const fresh = seen ? candidates.find((c) => !seen.has(c)) : undefined;
  const chosen = fresh ?? candidates[0];
  seen?.add(chosen);
  return chosen;
}
