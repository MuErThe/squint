"use client";

export type SfxName =
  | "rotate"
  | "step"
  | "lock"
  | "clear"
  | "clearBig"
  | "gameOver"
  | "start"
  | "pause"
  | "resume"
  | "quit";

const FILES: Record<SfxName, string> = {
  rotate: "/sounds/rotate.mp3",
  step: "/sounds/step.mp3",
  lock: "/sounds/lock.mp3",
  clear: "/sounds/clear.mp3",
  clearBig: "/sounds/clear-big.mp3",
  gameOver: "/sounds/game-over.mp3",
  start: "/sounds/start.mp3",
  pause: "/sounds/pause.mp3",
  resume: "/sounds/resume.mp3",
  quit: "/sounds/quit.mp3",
};

const POOL_SIZE = 3;
const pool: Partial<Record<SfxName, HTMLAudioElement[]>> = {};
/** undefined = unknown, true = mp3 loads, false = use synth */
const mp3Available: Partial<Record<SfxName, boolean>> = {};

let volume = 0.45;
let muted = false;
let unlocked = false;
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

function ensurePool(name: SfxName): HTMLAudioElement[] | null {
  if (typeof window === "undefined") return null;
  let arr = pool[name];
  if (!arr) {
    arr = Array.from({ length: POOL_SIZE }, () => {
      const a = new Audio(FILES[name]);
      a.preload = "auto";
      a.volume = volume;
      a.addEventListener(
        "error",
        () => {
          mp3Available[name] = false;
        },
        { once: true },
      );
      a.addEventListener(
        "canplaythrough",
        () => {
          mp3Available[name] = true;
        },
        { once: true },
      );
      return a;
    });
    pool[name] = arr;
  }
  return arr;
}

function pick(arr: HTMLAudioElement[]): HTMLAudioElement {
  for (const a of arr) if (a.paused || a.ended) return a;
  return arr[0];
}

// ---- Synth fallback (Web Audio) — fires when no mp3 is available -----------

function playTone(
  c: AudioContext,
  fromHz: number,
  toHz: number,
  durationS: number,
  type: OscillatorType,
  peakGain: number,
  delayS = 0,
): void {
  const now = c.currentTime + delayS;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fromHz, now);
  if (toHz !== fromHz) {
    osc.frequency.exponentialRampToValueAtTime(toHz, now + durationS);
  }
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peakGain * volume, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationS);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + durationS + 0.02);
}

function playSynth(name: SfxName): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  switch (name) {
    case "rotate":
      // Quick rising chirp — light, click-like.
      playTone(c, 520, 880, 0.07, "square", 0.18);
      break;
    case "step":
      // Very subtle low tick so the cumulative play rate stays unobtrusive.
      playTone(c, 220, 170, 0.04, "triangle", 0.05);
      break;
    case "lock":
      // Solid two-layer thunk: low square body + slightly higher snap.
      playTone(c, 130, 70, 0.12, "square", 0.28, 0);
      playTone(c, 220, 110, 0.08, "triangle", 0.18, 0);
      break;
    case "clear":
      // Bright ascending C–E–G arpeggio.
      playTone(c, 523, 523, 0.1, "sawtooth", 0.22, 0);
      playTone(c, 659, 659, 0.1, "sawtooth", 0.22, 0.08);
      playTone(c, 784, 784, 0.2, "sawtooth", 0.24, 0.16);
      break;
    case "clearBig":
      // Tetris fanfare: arpeggio + sustained octave with a square overtone.
      playTone(c, 523, 523, 0.1, "sawtooth", 0.24, 0);
      playTone(c, 659, 659, 0.1, "sawtooth", 0.24, 0.08);
      playTone(c, 784, 784, 0.1, "sawtooth", 0.24, 0.16);
      playTone(c, 1046, 1046, 0.45, "sawtooth", 0.28, 0.24);
      playTone(c, 1568, 1568, 0.35, "square", 0.12, 0.24);
      break;
    case "gameOver":
      // Slow descending minor melody — defeated, falling.
      playTone(c, 523, 523, 0.22, "sawtooth", 0.26, 0);
      playTone(c, 440, 440, 0.22, "sawtooth", 0.26, 0.22);
      playTone(c, 349, 349, 0.26, "sawtooth", 0.26, 0.44);
      playTone(c, 261, 196, 0.7, "sawtooth", 0.3, 0.7);
      break;
    case "start":
      // Optimistic power-up arpeggio with sustained top note.
      playTone(c, 392, 392, 0.08, "square", 0.18, 0);
      playTone(c, 523, 523, 0.08, "square", 0.18, 0.07);
      playTone(c, 659, 659, 0.08, "square", 0.18, 0.14);
      playTone(c, 784, 784, 0.28, "sawtooth", 0.22, 0.21);
      break;
    case "pause":
      // Two-tone descending boop.
      playTone(c, 660, 660, 0.06, "square", 0.18, 0);
      playTone(c, 440, 440, 0.12, "square", 0.18, 0.07);
      break;
    case "resume":
      // Two-tone ascending boop (mirror of pause).
      playTone(c, 440, 440, 0.06, "square", 0.18, 0);
      playTone(c, 660, 660, 0.12, "square", 0.18, 0.07);
      break;
    case "quit":
      // Soft descending whoosh.
      playTone(c, 392, 196, 0.32, "sawtooth", 0.22, 0);
      break;
  }
}

// ---- Public API ------------------------------------------------------------

export function playSfx(name: SfxName): void {
  if (muted || !unlocked) return;
  // If we already know the mp3 is unavailable, go straight to synth.
  if (mp3Available[name] === false) {
    playSynth(name);
    return;
  }
  const arr = ensurePool(name);
  if (!arr) {
    playSynth(name);
    return;
  }
  const a = pick(arr);
  a.volume = volume;
  try {
    a.currentTime = 0;
  } catch {
    /* metadata not ready */
  }
  const promise = a.play();
  if (!promise) return;
  promise.catch(() => {
    mp3Available[name] = false;
    playSynth(name);
  });
}

/**
 * Must be called from a real user gesture. Primes the audio pool and the
 * Web Audio context so subsequent plays from game logic aren't blocked.
 */
export function unlockAudio(): void {
  if (unlocked || typeof window === "undefined") return;
  unlocked = true;
  // Resume the synth context under the user gesture.
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
  // Prime each mp3 (so the browser allows them to play later, if present).
  (Object.keys(FILES) as SfxName[]).forEach((n) => {
    const arr = ensurePool(n);
    if (!arr) return;
    const a = arr[0];
    a.muted = true;
    a.play()
      .then(() => {
        a.pause();
        try {
          a.currentTime = 0;
        } catch {
          /* ignore */
        }
        a.muted = false;
      })
      .catch(() => {
        a.muted = false;
        mp3Available[n] = false;
      });
  });
}

export function setSfxMuted(m: boolean): void {
  muted = m;
}

export function isSfxMuted(): boolean {
  return muted;
}

export function setSfxVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  (Object.values(pool) as HTMLAudioElement[][]).forEach((arr) => {
    if (!arr) return;
    arr.forEach((a) => (a.volume = volume));
  });
}
