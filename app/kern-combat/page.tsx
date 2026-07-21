"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameShell, type GameResult } from "@/components/arcade/GameShell";
import { GameLayout } from "@/components/arcade/GameLayout";
import { RoundReveal } from "@/components/arcade/RoundReveal";
import { pairRule, scoreGaps } from "@/lib/kern/engine";
import {
  KERN_CATEGORIES,
  MAX_ROUND_POINTS,
  ROUNDS_PER_SESSION,
  WORDS,
  type KernCategory,
  type KernWord,
} from "@/lib/kern/types";
import { KERN_COLUMNS, KERN_GAME } from "@/lib/kern/leaderboard";
import { buildSequence } from "@/lib/learning/adaptive";
import { pickLesson } from "@/lib/learning/lessons";
import {
  recordSession,
  typeAccuracy,
  type RoundRecord,
} from "@/lib/learning/progress";
import { playSfx } from "@/lib/audio/sfx";

const DESIRED_PX = 100;
const MIN_PX = 34;

// Module-level canvas for measuring the font's own kerned metrics.
let sharedCanvas: HTMLCanvasElement | null = null;
function measureCtx(): CanvasRenderingContext2D {
  if (!sharedCanvas) sharedCanvas = document.createElement("canvas");
  return sharedCanvas.getContext("2d")!;
}
function kernFamily(): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-kern")
    .trim();
  return v || "serif";
}
/** Cumulative left positions per glyph (length n+1), with the font's kerning. */
function cumulativePositions(word: string, px: number, family: string): number[] {
  const ctx = measureCtx();
  ctx.font = `600 ${px}px ${family}`;
  const pos = [0];
  for (let i = 1; i <= word.length; i++) {
    pos.push(ctx.measureText(word.slice(0, i)).width);
  }
  return pos;
}

export default function KernCombatPage() {
  return (
    <GameShell
      gameId={KERN_GAME}
      title={
        <>
          KERN <span style={{ color: "var(--accent)" }}>COMBAT</span>
        </>
      }
      trains="typographic craft"
      pitch="drag the letters until the spacing feels even — then grade your eye against the type designer's own metrics."
      howTo={[
        "drag any letter left/right; it carries the letters after it",
        "even rhythm is the goal — no gap louder than the rest",
        "lock it in to see the true spacing and what you missed",
      ]}
      columns={KERN_COLUMNS}
      eyebrow="steadiest hands"
      countNoun="kerners"
      vignette="kern"
      accent="var(--c-T)"
    >
      {({ onFinish }) => <KernGame onFinish={onFinish} />}
    </GameShell>
  );
}

interface RoundState {
  word: string;
  fontPx: number;
  ideal: number[];
  pad: number;
}

export function KernGame({
  onFinish,
  roundCount = ROUNDS_PER_SESSION,
  record = true,
}: {
  onFinish: (r: GameResult) => void;
  roundCount?: number;
  record?: boolean;
}) {
  const seqRef = useRef<KernCategory[]>([]);
  const usedRef = useRef<Set<string>>(new Set());
  const roundsRef = useRef<RoundRecord[]>([]);
  const seenLessonsRef = useRef<Set<string>>(new Set());
  const mountAtRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ i: number; startX: number; base: number[] } | null>(null);

  const [roundIdx, setRoundIdx] = useState(0);
  const [word, setWord] = useState<KernWord | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [positions, setPositions] = useState<number[]>([]);
  const [locked, setLocked] = useState<{
    score: ReturnType<typeof scoreGaps>;
    principle: string;
    pair: string;
  } | null>(null);
  const [score, setScore] = useState(0);

  const pickWord = useCallback((category: KernCategory): KernWord => {
    const pool = WORDS.filter((w) => w.category === category);
    const fresh = pool.filter((w) => !usedRef.current.has(w.text));
    const choice = (fresh.length ? fresh : pool)[
      Math.floor(Math.random() * (fresh.length ? fresh.length : pool.length))
    ];
    usedRef.current.add(choice.text);
    return choice;
  }, []);

  // Build the adaptive category sequence and choose the first word, once.
  useEffect(() => {
    seqRef.current = buildSequence(
      KERN_CATEGORIES,
      typeAccuracy(KERN_GAME),
      roundCount,
    );
    mountAtRef.current = performance.now();
    setWord(pickWord(seqRef.current[0]));
  }, [pickWord]);

  // Whenever the word changes, measure the font's kerned layout and perturb.
  useEffect(() => {
    if (!word) return;
    let cancelled = false;
    const layout = () => {
      if (cancelled) return;
      const avail = containerRef.current?.clientWidth ?? 640;
      const family = kernFamily();
      const ref = cumulativePositions(word.text, DESIRED_PX, family);
      const naturalW = ref[ref.length - 1];
      const fontPx = Math.max(
        MIN_PX,
        Math.min(DESIRED_PX, (avail * 0.84 * DESIRED_PX) / naturalW),
      );
      const ideal = cumulativePositions(word.text, fontPx, family);
      const naturalWidth = ideal[ideal.length - 1];
      const pad = Math.max(8, (avail - naturalWidth) / 2);

      // Perturb each interior gap by ±0.16em; shift the tail rigidly.
      const perturbed = [...ideal];
      let cum = 0;
      for (let i = 1; i < ideal.length; i++) {
        const d = (Math.random() * 2 - 1) * fontPx * 0.16;
        cum += d;
        perturbed[i] = ideal[i] + cum;
      }
      setRound({ word: word.text, fontPx, ideal, pad });
      setPositions(perturbed);
      setLocked(null);
    };
    if (document.fonts?.ready) {
      document.fonts.ready.then(layout);
    } else {
      layout();
    }
    return () => {
      cancelled = true;
    };
  }, [word]);

  const onGlyphDown = (i: number) => (e: React.PointerEvent<HTMLSpanElement>) => {
    if (locked || i === 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { i, startX: e.clientX, base: [...positions] };
  };
  const onGlyphMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    setPositions(d.base.map((p, j) => (j >= d.i ? p + dx : p)));
  };
  const onGlyphUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (dragRef.current) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      dragRef.current = null;
    }
  };

  const lockIn = useCallback(() => {
    if (!round || !word || locked) return;
    if (performance.now() - mountAtRef.current < 300) return;
    const sc = scoreGaps(positions, round.ideal, round.fontPx);
    roundsRef.current.push({
      type: word.category,
      errorPct: sc.errorPct,
      points: sc.points,
    });
    setScore((s) => s + sc.points);
    const a = word.text[sc.worstGap - 1] ?? "";
    const b = word.text[sc.worstGap] ?? "";
    const principle = pickLesson(
      KERN_GAME,
      pairRule(a, b),
      sc.worstTag,
      seenLessonsRef.current,
    );
    playSfx(sc.points >= MAX_ROUND_POINTS * 0.85 ? "clearBig" : "lock");
    setLocked({ score: sc, principle, pair: `${a}${b}` });
  }, [round, word, positions, locked]);

  const next = useCallback(() => {
    const nextIdx = roundIdx + 1;
    if (nextIdx >= roundCount) {
      const rounds = roundsRef.current;
      const meanError =
        rounds.reduce((a, r) => a + r.errorPct, 0) / (rounds.length || 1);
      const acc = Math.round(100 * (1 - meanError));
      if (record) recordSession(KERN_GAME, score, rounds);
      const headline = acc >= 85 ? "TIGHT KERNING" : acc >= 65 ? "GOOD SPACING" : "MIND THE GAPS";
      onFinish({
        score,
        meta: { acc, words: roundCount },
        stats: [
          { label: "accuracy", value: `${acc}%` },
          { label: "words", value: roundCount },
        ],
        headline,
      });
      return;
    }
    setRoundIdx(nextIdx);
    setWord(pickWord(seqRef.current[nextIdx]));
  }, [roundIdx, score, onFinish, pickWord, roundCount, record]);

  const glyphs = round?.word.split("") ?? [];

  return (
    <GameLayout
      typeLabel={word?.category.toUpperCase() ?? "KERN"}
      roundIdx={roundIdx}
      roundCount={roundCount}
      score={score}
      prompt={locked ? "the ghost shows the ideal spacing →" : "drag the letters until every gap feels even"}
      accent="var(--c-T)"
      results={roundsRef.current.map((r) => r.points / MAX_ROUND_POINTS)}
      reveal={
        locked ? (
          <RoundReveal
            show
            compact
            points={locked.score.points}
            maxPoints={MAX_ROUND_POINTS}
            detail={`worst pair · ${locked.pair} · too ${locked.score.worstTag}`}
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
      {/* Kerning surface */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div
          ref={containerRef}
          className="relative w-full rounded-[2px] border overflow-hidden"
          style={{
            maxWidth: 820,
            height: 240,
            borderColor: "var(--panel-border-strong)",
            background: "var(--board-bg)",
            touchAction: "none",
          }}
        >
          {/* specimen guides: cap line + baseline, like a type sheet */}
          {round && (
            <>
              <div
                className="absolute inset-x-0"
                style={{
                  top: `calc(50% - ${round.fontPx * 0.36}px)`,
                  height: 1,
                  background: "var(--board-line)",
                }}
              />
              <div
                className="absolute inset-x-0"
                style={{
                  top: `calc(50% + ${round.fontPx * 0.36}px)`,
                  height: 1,
                  background: "var(--board-line)",
                }}
              />
            </>
          )}

          {/* specimen caption */}
          {round && (
            <span
              className="absolute font-mono uppercase"
              style={{
                left: 10,
                bottom: 8,
                fontSize: 9,
                letterSpacing: "0.18em",
                color: "var(--board-tick)",
              }}
            >
              {round.word.toLowerCase()} · fraunces 600 · {Math.round(round.fontPx)}px
            </span>
          )}

          {round &&
            glyphs.map((ch, i) => (
              <span
                key={i}
                onPointerDown={onGlyphDown(i)}
                onPointerMove={onGlyphMove}
                onPointerUp={onGlyphUp}
                className="absolute select-none"
                style={{
                  left: round.pad + (positions[i] ?? 0),
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontFamily: "var(--font-kern), serif",
                  fontWeight: 600,
                  fontSize: round.fontPx,
                  lineHeight: 1,
                  color:
                    locked && (i === locked.score.worstGap || i === locked.score.worstGap - 1)
                      ? "var(--accent-hot)"
                      : "var(--ink)",
                  cursor: locked ? "default" : i === 0 ? "default" : "ew-resize",
                  touchAction: "none",
                }}
              >
                {ch}
              </span>
            ))}

          {/* Ideal ghost overlay, shown on reveal */}
          {round &&
            locked &&
            glyphs.map((ch, i) => (
              <span
                key={`ghost-${i}`}
                className="absolute select-none pointer-events-none"
                style={{
                  left: round.pad + round.ideal[i],
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontFamily: "var(--font-kern), serif",
                  fontWeight: 600,
                  fontSize: round.fontPx,
                  lineHeight: 1,
                  color: "var(--c-S)",
                  opacity: 0.28,
                }}
              >
                {ch}
              </span>
            ))}

          {/* Per-gap deviation ticks: up = too wide, down = too tight. */}
          {round && locked && (
            <div className="absolute inset-x-0 pointer-events-none" style={{ bottom: 26, height: 30 }}>
              {/* zero axis */}
              <div className="absolute inset-x-0" style={{ top: "50%", height: 1, background: "var(--board-line)" }} />
              {glyphs.slice(1).map((_, idx) => {
                const i = idx + 1;
                const dev =
                  (positions[i] - positions[i - 1]) - (round.ideal[i] - round.ideal[i - 1]);
                const capPx = round.fontPx * 0.24;
                const h = Math.min(Math.abs(dev), capPx) * (13 / capPx);
                const x = round.pad + (positions[i - 1] + positions[i]) / 2 + round.fontPx * 0.18;
                const worst = i === locked.score.worstGap;
                return (
                  <div
                    key={i}
                    className="absolute"
                    style={{
                      left: x,
                      width: 3,
                      height: Math.max(2, h),
                      background: worst ? "var(--accent-hot)" : "var(--ink-dim)",
                      opacity: worst ? 1 : 0.55,
                      top: dev >= 0 ? `calc(50% - ${Math.max(2, h)}px)` : "50%",
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </GameLayout>
  );
}
