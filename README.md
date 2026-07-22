# Squint

*Train the eye you trust.* A small arcade of five-minute games that sharpen
a designer's eye, hand and imagination — divergent-thinking sprints and craft
trainers, plus feedback and local progress tracking so they double as
practice, not just play. Live at **https://squint.mdzabeeh.com/**.

The hub (`/`) links out to each game. First up is **Hand Tetris**
(`/tetris`); Eyeball It, Kern Combat, Colour Forge and Thirty Circles follow.
All games share one arcade identity and a per-game leaderboard
(see `supabase/schema.sql`, and `supabase/migrations/` for the multi-game
migration).

## Focalism

The UI is built in **Focalism**, a design language invented for Squint —
*hierarchy is focus*. Depth comes from focal planes (blur steps) instead of
shadows, transitions are focus racks, colour appears only as signal, and
erring marks fringe with chromatic aberration. Play surfaces sit on lit warm
paper while the cabinet stays dark — colour and type are judged truly against
a light ground. The manifesto, live specimens and adoption recipes live at
[/focalism](https://squint.mdzabeeh.com/focalism/).

## Hand Tetris — controls

| Gesture | Action |
| --- | --- |
| Move hand left / right | Steer the piece between columns |
| Pinch (thumb + index, hand open) | Rotate 90° clockwise |
| Lower hand into the bottom strip | Fast-fall |

Keyboard works too (no camera required): **← →** move, **↑** rotate,
**↓** soft drop, **Space** hard drop, **P** pause, **Q** quit. Press **D**
in-game to toggle the tracking debug overlay (confidence, model FPS,
gesture state).

## Privacy

**Camera video never leaves your device.** Frames go straight from the
webcam into MediaPipe Hands running locally in your browser (WebAssembly);
no video or landmark data is uploaded anywhere. The camera is released
(light off) whenever the tab is hidden or closed. The only network calls the
game makes are fetching the ML model files from jsDelivr and, if you join
the leaderboard, submitting your name + score to Supabase.

## How tracking stays accurate

- **MediaPipe Hands** (full model, pinned version) at 1280×720
- **One Euro Filter** on the steering signal — smooth at rest, no lag on
  fast moves
- **Confidence gating** — frames below a model-score threshold are ignored
- **Dropout grace window** — a briefly lost hand doesn't reset gesture state
- **Frame debouncing + hysteresis** on pinch and drop-zone so no gesture can
  trigger off a single noisy frame or flicker at a boundary
- All thresholds are named constants in `lib/hand/gestures.ts` and
  `lib/hand/tracker.ts`

## Stack

Next.js (static export) · React Three Fiber · MediaPipe Hands · Tailwind ·
Supabase (leaderboard, optional). Deployed to GitHub Pages via the workflow
in `.github/workflows/deploy.yml`.

See [SETUP.md](./SETUP.md) for local development, Supabase setup, and
deployment details.
