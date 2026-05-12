# Game sound effects

The audio module (`lib/audio/sfx.ts`) plays **synthesized Web Audio blips** by
default — no asset files are required. If you want to override any cue with a
real audio clip, drop a matching file in this folder and it will take over
automatically.

| File              | Synth fallback                              | Played when                                      |
| ----------------- | ------------------------------------------- | ------------------------------------------------ |
| `rotate.mp3`      | Quick rising square chirp (520→880 Hz)      | Piece rotates                                    |
| `step.mp3`        | Subtle low triangle tick                    | Piece falls one row (gravity or soft drop)       |
| `lock.mp3`        | Two-layer wood-block thunk                  | Piece locks into the stack                       |
| `clear.mp3`       | C–E–G sawtooth arpeggio                     | 1–3 lines clear                                  |
| `clear-big.mp3`   | C–E–G + high-octave fanfare                 | 4-line tetris                                    |
| `game-over.mp3`   | Slow descending C–A–F–C minor melody        | Natural top-out (not manual quit)                |

## Volume / mute

Default volume is `0.45`. Adjust with `setSfxVolume(v)` (0–1) or silence
everything with `setSfxMuted(true)`. Audio is unlocked on the first START
click — browsers block any sound before a user gesture.
