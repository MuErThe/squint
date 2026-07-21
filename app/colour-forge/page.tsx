"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameShell, type GameResult } from "@/components/arcade/GameShell";
import { GameLayout } from "@/components/arcade/GameLayout";
import { RoundReveal } from "@/components/arcade/RoundReveal";
import { generate, evaluate, COLOUR_TYPES, TYPE_LABEL, MAX_ROUND_POINTS, ROUNDS_PER_SESSION, type ColourRound } from "@/lib/colour/engine";
import { COLOUR_COLUMNS, COLOUR_GAME } from "@/lib/colour/leaderboard";
import { hslToCss, hueDelta, type Hsl } from "@/lib/colour/space";
import { buildSequence } from "@/lib/learning/adaptive";
import { pickLesson } from "@/lib/learning/lessons";
import { recordSession, typeAccuracy, type RoundRecord } from "@/lib/learning/progress";
import { playSfx } from "@/lib/audio/sfx";

const MEMORISE_MS = 3000;
const START_ATTEMPT: Hsl = { h: 200, s: 40, l: 55 };

export default function ColourForgePage() {
  return (
    <GameShell
      gameId={COLOUR_GAME}
      title={<>COLOUR <span style={{ color: "var(--accent)" }}>FORGE</span></>}
      trains="colour perception"
      pitch="mix to match the target across eight rounds — and learn which way your eye tends to lie."
      howTo={[
        "drag the H · S · L sliders to mix your colour",
        "match, match from memory, or find the complement",
        "lock in to see the true colour and your error on each axis",
      ]}
      columns={COLOUR_COLUMNS}
      eyebrow="truest eyes"
      countNoun="mixers"
      vignette="colour"
      accent="var(--c-Z)"
    >
      {({ onFinish }) => <ColourGame onFinish={onFinish} />}
    </GameShell>
  );
}

export function ColourGame({
  onFinish,
  roundCount = ROUNDS_PER_SESSION,
  record = true,
}: {
  onFinish: (r: GameResult) => void;
  roundCount?: number;
  record?: boolean;
}) {
  const seqRef = useRef<(typeof COLOUR_TYPES)[number][]>([]);
  const roundsRef = useRef<RoundRecord[]>([]);
  const seenLessonsRef = useRef<Set<string>>(new Set());
  const mountAtRef = useRef(0);
  const memoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState<ColourRound | null>(null);
  const [attempt, setAttempt] = useState<Hsl>(START_ATTEMPT);
  const [showTarget, setShowTarget] = useState(true);
  const [locked, setLocked] = useState<{ ev: ReturnType<typeof evaluate>; principle: string } | null>(null);
  const [score, setScore] = useState(0);

  const startRound = useCallback((r: ColourRound) => {
    if (memoryTimerRef.current) clearTimeout(memoryTimerRef.current);
    setRound(r);
    setAttempt(START_ATTEMPT);
    setLocked(null);
    if (r.type === "memory") {
      setShowTarget(true);
      memoryTimerRef.current = setTimeout(() => setShowTarget(false), MEMORISE_MS);
    } else {
      setShowTarget(true);
    }
  }, []);

  useEffect(() => {
    seqRef.current = buildSequence(COLOUR_TYPES, typeAccuracy(COLOUR_GAME), roundCount);
    mountAtRef.current = performance.now();
    startRound(generate(seqRef.current[0]));
    return () => {
      if (memoryTimerRef.current) clearTimeout(memoryTimerRef.current);
    };
  }, [startRound]);

  const lockIn = useCallback(() => {
    if (!round || locked) return;
    if (performance.now() - mountAtRef.current < 300) return;
    const ev = evaluate(round, attempt);
    roundsRef.current.push({ type: round.type, errorPct: ev.errorPct, points: ev.points });
    setScore((s) => s + ev.points);
    const principle = pickLesson(COLOUR_GAME, ev.axis, ev.dir, seenLessonsRef.current);
    playSfx(ev.points >= MAX_ROUND_POINTS * 0.85 ? "clearBig" : "lock");
    setShowTarget(true); // reveal the target regardless of round type
    setLocked({ ev, principle });
  }, [round, attempt, locked]);

  const next = useCallback(() => {
    const nextIdx = roundIdx + 1;
    if (nextIdx >= roundCount) {
      const rounds = roundsRef.current;
      const meanError = rounds.reduce((a, r) => a + r.errorPct, 0) / (rounds.length || 1);
      const acc = Math.round(100 * (1 - meanError));
      const avgDe = Math.round(
        rounds.reduce((a, r) => a + r.errorPct, 0) / (rounds.length || 1) * 45,
      );
      if (record) recordSession(COLOUR_GAME, score, rounds);
      const headline = acc >= 85 ? "TRUE EYE" : acc >= 65 ? "GOOD MIX" : "OFF-HUE";
      onFinish({
        score,
        meta: { acc, avgDe },
        stats: [
          { label: "accuracy", value: `${acc}%` },
          { label: "avg ΔE", value: avgDe },
          { label: "rounds", value: roundCount },
        ],
        headline,
      });
      return;
    }
    setRoundIdx(nextIdx);
    startRound(generate(seqRef.current[nextIdx]));
  }, [roundIdx, score, onFinish, startRound, roundCount, record]);

  if (!round) return null;

  const targetHidden = round.type === "memory" && !showTarget && !locked;

  return (
    <GameLayout
      typeLabel={TYPE_LABEL[round.type]}
      roundIdx={roundIdx}
      roundCount={roundCount}
      score={score}
      prompt={
        locked
          ? "left is the target, right is your mix →"
          : round.type === "complement"
            ? "mix the COMPLEMENT of the colour on the left"
            : round.type === "memory"
              ? showTarget
                ? "memorise it…"
                : "now mix it from memory"
              : "mix your colour to match the target"
      }
      accent="var(--c-Z)"
      results={roundsRef.current.map((r) => r.points / MAX_ROUND_POINTS)}
      reveal={
        locked ? (
          <RoundReveal
            show
            compact
            points={locked.ev.points}
            maxPoints={MAX_ROUND_POINTS}
            detail={locked.ev.breakdown}
            principle={locked.principle}
            isLast={roundIdx + 1 >= roundCount}
            onContinue={next}
          />
        ) : null
      }
      action={
        !locked ? (
          <button
            type="button"
            onClick={lockIn}
            className="font-display tracking-[0.24em] text-[13px] px-6 py-3 border w-full transition-all duration-150 hover:bg-[rgba(245,182,81,0.2)]"
            style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(245,182,81,0.1)" }}
          >
            ▣ LOCK IT IN
          </button>
        ) : undefined
      }
    >
      {/* Play / reveal area */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5">
        {!locked ? (
          <>
            <div className="flex items-stretch gap-4">
              <Swatch
                label={round.type === "complement" ? "BASE" : "TARGET"}
                colour={
                  round.type === "complement"
                    ? hslToCss(round.base!)
                    : targetHidden
                      ? null
                      : hslToCss(round.target)
                }
                placeholder={targetHidden ? "?" : undefined}
              />
              <Swatch
                label="YOUR MIX"
                colour={hslToCss(attempt)}
                caption={`H ${attempt.h} · S ${attempt.s} · L ${attempt.l}`}
              />
            </div>

            <div className="w-full max-w-[440px] flex flex-col gap-3">
              <ColourSlider
                label="HUE"
                value={attempt.h}
                min={0}
                max={360}
                gradient={hueGradient(attempt)}
                onChange={(h) => setAttempt((a) => ({ ...a, h }))}
              />
              <ColourSlider
                label="SATURATION"
                value={attempt.s}
                min={0}
                max={100}
                gradient={`linear-gradient(90deg, ${hslToCss({ ...attempt, s: 0 })}, ${hslToCss({ ...attempt, s: 100 })})`}
                onChange={(s) => setAttempt((a) => ({ ...a, s }))}
              />
              <ColourSlider
                label="LIGHTNESS"
                value={attempt.l}
                min={0}
                max={100}
                gradient={`linear-gradient(90deg, #000, ${hslToCss({ ...attempt, l: 50 })}, #fff)`}
                onChange={(l) => setAttempt((a) => ({ ...a, l }))}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {/* Butted comparison — the seam reveals the last of the error. */}
            <div className="flex rounded-[2px] overflow-hidden border" style={{ borderColor: "var(--board-line)" }}>
              <div style={{ width: 190, height: 150, background: hslToCss(round.target) }} />
              <div style={{ width: 190, height: 150, background: hslToCss(attempt) }} />
            </div>
            <div className="flex w-full justify-between font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--ink-dim)" }}>
              <span>target</span>
              <span>
                ΔE <span className="font-display" style={{ color: "var(--accent)" }}>{locked.ev.deltaE.toFixed(1)}</span>
              </span>
              <span>your mix</span>
            </div>

            {/* Signed per-channel misses — which way your eye lied. */}
            <div className="w-full flex flex-col gap-1.5" style={{ maxWidth: 380 }}>
              <DeltaBar label="hue" value={hueDelta(round.target.h, attempt.h)} range={60} unit="°" />
              <DeltaBar label="sat" value={attempt.s - round.target.s} range={40} />
              <DeltaBar label="light" value={attempt.l - round.target.l} range={40} />
            </div>
          </div>
        )}
      </div>
    </GameLayout>
  );
}

function hueGradient(a: Hsl): string {
  const stops: string[] = [];
  for (let h = 0; h <= 360; h += 60) stops.push(hslToCss({ ...a, h }));
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

function Swatch({
  label,
  colour,
  placeholder,
  caption,
}: {
  label: string;
  colour: string | null;
  placeholder?: string;
  /** Live values line under the chip (mono), e.g. "H 200 · S 40 · L 55". */
  caption?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="rounded-[2px] border flex items-center justify-center"
        style={{
          width: 150,
          height: 150,
          background: colour ?? "var(--board-bg)",
          borderColor: "var(--board-line)",
        }}
      >
        {placeholder && (
          <span className="font-display text-2xl" style={{ color: "var(--ink-dim)" }}>
            {placeholder}
          </span>
        )}
      </div>
      <span className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--ink-dim)" }}>
        {label}
      </span>
      <span
        className="font-mono text-[9px] tracking-[0.1em]"
        style={{ color: "var(--board-tick)", minHeight: 12 }}
      >
        {caption ?? ""}
      </span>
    </div>
  );
}

/** A centred-zero signed bar: which way, and how far, one channel missed. */
function DeltaBar({
  label,
  value,
  range,
  unit = "",
}: {
  label: string;
  value: number;
  range: number;
  unit?: string;
}) {
  const frac = Math.max(-1, Math.min(1, value / range));
  const half = Math.abs(frac) * 50;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-right" style={{ color: "var(--ink-dim)", width: 38 }}>
        {label}
      </span>
      <div className="relative flex-1 rounded-full" style={{ height: 6, background: "rgba(0,0,0,0.35)", border: "1px solid var(--board-line)" }}>
        {/* zero mark */}
        <div className="absolute" style={{ left: "50%", top: -2, width: 1, height: 10, background: "var(--board-tick)" }} />
        <div
          className="absolute rounded-full"
          style={{
            top: 1,
            height: 4,
            left: frac >= 0 ? "50%" : `${50 - half}%`,
            width: `${half}%`,
            background: Math.abs(frac) > 0.5 ? "var(--accent-hot)" : "var(--accent)",
          }}
        />
      </div>
      <span className="font-mono text-[9px] tracking-[0.08em] text-right" style={{ color: "var(--ink)", width: 40 }}>
        {value > 0 ? "+" : ""}
        {Math.round(value)}
        {unit}
      </span>
    </div>
  );
}

function ColourSlider({
  label,
  value,
  min,
  max,
  gradient,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  gradient: string;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pct = ((value - min) / (max - min)) * 100;

  const setFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(Math.round(min + t * (max - min)));
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-dim)" }}>
        <span>{label}</span>
        <span className="font-display" style={{ color: "var(--ink)" }}>{value}</span>
      </div>
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          draggingRef.current = true;
          setFromX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) setFromX(e.clientX);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        }}
        className="relative rounded-full"
        style={{ height: 10, background: gradient, cursor: "pointer", touchAction: "none", border: "1px solid rgba(0,0,0,0.4)" }}
      >
        {/* hairline thumb — a precision caret, not a knob */}
        <div
          className="absolute"
          style={{
            left: `${pct}%`,
            top: "50%",
            width: 4,
            height: 18,
            transform: "translate(-50%, -50%)",
            background: "#fff",
            border: "1px solid #1a1108",
            borderRadius: 1,
            boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
