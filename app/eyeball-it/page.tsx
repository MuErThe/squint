"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameShell, type GameResult } from "@/components/arcade/GameShell";
import { GameLayout } from "@/components/arcade/GameLayout";
import { RoundReveal } from "@/components/arcade/RoundReveal";
import { generate, evaluate } from "@/lib/eyeball/engine";
import {
  type Challenge,
  type Evaluation,
  type EyeballType,
  type Guess,
  EYEBALL_TYPES,
  MAX_ROUND_POINTS,
  ROUNDS_PER_SESSION,
  TYPE_LABEL,
} from "@/lib/eyeball/types";
import { EYEBALL_COLUMNS, EYEBALL_GAME } from "@/lib/eyeball/leaderboard";
import { buildSequence } from "@/lib/learning/adaptive";
import { pickLesson } from "@/lib/learning/lessons";
import {
  recordSession,
  typeAccuracy,
  type RoundRecord,
} from "@/lib/learning/progress";
import { playSfx } from "@/lib/audio/sfx";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export default function EyeballItPage() {
  return (
    <GameShell
      gameId={EYEBALL_GAME}
      title={
        <>
          EYEBALL <span style={{ color: "var(--accent)" }}>IT</span>
        </>
      }
      trains="the trained eye"
      pitch="ten quick calls of the eye — bisect, centre, angle, proportion. Then see exactly how close you were."
      howTo={[
        "aim with your pointer, click to lock in your guess",
        "the truth is revealed with a one-line lesson each round",
        "rounds lean toward whatever you're worst at",
      ]}
      columns={EYEBALL_COLUMNS}
      eyebrow="sharpest eyes"
      countNoun="eyes"
      vignette="eyeball"
      accent="var(--c-S)"
    >
      {({ onFinish }) => <EyeballGame onFinish={onFinish} />}
    </GameShell>
  );
}

export function EyeballGame({
  onFinish,
  roundCount = ROUNDS_PER_SESSION,
  record = true,
}: {
  onFinish: (r: GameResult) => void;
  roundCount?: number;
  record?: boolean;
}) {
  const seqRef = useRef<EyeballType[]>([]);
  const roundsRef = useRef<RoundRecord[]>([]);
  const seenLessonsRef = useRef<Set<string>>(new Set());
  // Ignore commits fired in the first moments of a round — stops the click that
  // dismissed the start overlay (or a double-tap) from committing instantly.
  const roundStartRef = useRef(0);

  const [roundIdx, setRoundIdx] = useState(0);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [preview, setPreview] = useState<Guess | null>(null);
  const [locked, setLocked] = useState<{
    guess: Guess;
    ev: Evaluation;
    principle: string;
  } | null>(null);
  const [score, setScore] = useState(0);

  // Build an adaptive sequence and start round 0, once.
  useEffect(() => {
    seqRef.current = buildSequence(
      EYEBALL_TYPES,
      typeAccuracy(EYEBALL_GAME),
      roundCount,
    );
    roundStartRef.current = performance.now();
    setChallenge(generate(seqRef.current[0]));
  }, []);

  const commit = useCallback(
    (guess: Guess) => {
      if (!challenge || locked) return;
      // Reject a commit that lands within 200ms of the round starting.
      if (performance.now() - roundStartRef.current < 200) return;
      const ev = evaluate(challenge, guess);
      roundsRef.current.push({
        type: challenge.type,
        errorPct: ev.errorPct,
        points: ev.points,
      });
      setScore((s) => s + ev.points);
      const principle = pickLesson(
        EYEBALL_GAME,
        challenge.type,
        ev.tag,
        seenLessonsRef.current,
      );
      playSfx(ev.points >= MAX_ROUND_POINTS * 0.85 ? "clearBig" : "lock");
      setLocked({ guess, ev, principle });
    },
    [challenge, locked],
  );

  const next = useCallback(() => {
    const nextIdx = roundIdx + 1;
    if (nextIdx >= roundCount) {
      const rounds = roundsRef.current;
      const meanError =
        rounds.reduce((a, r) => a + r.errorPct, 0) / (rounds.length || 1);
      const acc = Math.round(100 * (1 - meanError));
      const bestRound = rounds.reduce((m, r) => Math.max(m, r.points), 0);
      if (record) recordSession(EYEBALL_GAME, score, rounds);
      const headline = acc >= 85 ? "SHARP EYE" : acc >= 65 ? "GOOD EYE" : "KEEP LOOKING";
      onFinish({
        score,
        meta: { acc, best: bestRound },
        stats: [
          { label: "accuracy", value: `${acc}%` },
          { label: "best round", value: bestRound },
          { label: "rounds", value: roundCount },
        ],
        headline,
      });
      return;
    }
    setRoundIdx(nextIdx);
    setPreview(null);
    setLocked(null);
    roundStartRef.current = performance.now();
    setChallenge(generate(seqRef.current[nextIdx]));
  }, [roundIdx, score, onFinish, roundCount, record]);

  if (!challenge) return null;

  return (
    <GameLayout
      typeLabel={TYPE_LABEL[challenge.type]}
      roundIdx={roundIdx}
      roundCount={roundCount}
      score={score}
      prompt={locked ? "here's how you did →" : challenge.prompt}
      accent="var(--c-S)"
      results={roundsRef.current.map((r) => r.points / MAX_ROUND_POINTS)}
      reveal={
        locked ? (
          <RoundReveal
            show
            compact
            points={locked.ev.points}
            maxPoints={MAX_ROUND_POINTS}
            detail={`you ${locked.ev.guessDisplay} · true ${locked.ev.targetDisplay} · off ${locked.ev.errorDisplay}`}
            principle={locked.principle}
            isLast={roundIdx + 1 >= roundCount}
            onContinue={next}
          />
        ) : null
      }
    >
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="relative w-full" style={{ maxWidth: 560, aspectRatio: "1 / 1", maxHeight: "100%" }}>
          <PlaySurface
            challenge={challenge}
            preview={preview}
            locked={locked}
            onAim={setPreview}
            onCommit={commit}
          />
        </div>
      </div>
    </GameLayout>
  );
}

/** Convert a mouse/pointer event to normalised 0..1 play-area coords. */
function coordsOf(e: {
  clientX: number;
  clientY: number;
  currentTarget: SVGSVGElement;
}): { x: number; y: number } {
  const rect = e.currentTarget.getBoundingClientRect();
  return {
    x: clamp01((e.clientX - rect.left) / rect.width),
    y: clamp01((e.clientY - rect.top) / rect.height),
  };
}

function guessFrom(challenge: Challenge, c: { x: number; y: number }): Guess {
  if (challenge.kind === "linear") {
    return { kind: "linear", value: challenge.axis === "x" ? c.x : c.y };
  }
  if (challenge.kind === "point") {
    return { kind: "point", x: c.x, y: c.y };
  }
  // angle
  const dx = c.x - challenge.pivot.x;
  const dyUp = challenge.pivot.y - c.y;
  let deg = (Math.atan2(dyUp, dx) * 180) / Math.PI;
  deg = Math.max(0, Math.min(180, deg));
  return { kind: "angle", deg };
}

function PlaySurface({
  challenge,
  preview,
  locked,
  onAim,
  onCommit,
}: {
  challenge: Challenge;
  preview: Guess | null;
  locked: { guess: Guess; ev: Evaluation } | null;
  onAim: (g: Guess) => void;
  onCommit: (g: Guess) => void;
}) {
  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (locked) return;
    onAim(guessFrom(challenge, coordsOf(e)));
  };
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (locked) return;
    onCommit(guessFrom(challenge, coordsOf(e)));
  };

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full rounded-[2px] border"
      style={{
        borderColor: "var(--panel-border-strong)",
        background: "var(--board-bg)",
        cursor: locked ? "default" : "crosshair",
        touchAction: "none",
      }}
      onPointerMove={handleMove}
      onClick={handleClick}
    >
      {/* artboard frame + edge rulers */}
      <rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="var(--board-line)" strokeWidth="0.4" />
      <Rulers />

      {challenge.kind === "linear" && (
        <LinearLayer challenge={challenge} preview={preview} locked={locked} />
      )}
      {challenge.kind === "point" && (
        <PointLayer challenge={challenge} preview={preview} locked={locked} />
      )}
      {challenge.kind === "angle" && (
        <AngleLayer challenge={challenge} preview={preview} locked={locked} />
      )}
    </svg>
  );
}

/** Faint ruler ticks along the top and left edges — the artboard's measure. */
function Rulers() {
  const ticks = [];
  for (let i = 10; i <= 90; i += 10) {
    const major = i === 50;
    const len = major ? 3 : 1.8;
    ticks.push(
      <line key={`t${i}`} x1={i} y1={0.5} x2={i} y2={0.5 + len} stroke="var(--board-tick)" strokeWidth={major ? 0.4 : 0.25} />,
      <line key={`l${i}`} x1={0.5} y1={i} x2={0.5 + len} y2={i} stroke="var(--board-tick)" strokeWidth={major ? 0.4 : 0.25} />,
    );
  }
  return <g opacity="0.8">{ticks}</g>;
}

/** A redline dimension annotation between two parallel values (design-spec style). */
function RedlineLinear({
  horizontal,
  a,
  b,
  label,
  at = 22,
}: {
  horizontal: boolean;
  a: number;
  b: number;
  label: string;
  at?: number;
}) {
  const p1 = Math.min(a, b) * 100;
  const p2 = Math.max(a, b) * 100;
  const mid = (p1 + p2) / 2;
  if (p2 - p1 < 0.6) {
    // Nearly on top of each other — just the label.
    return (
      <text
        x={horizontal ? mid : at}
        y={horizontal ? at : mid - 1.6}
        fontSize="3"
        fill="var(--accent-hot)"
        textAnchor="middle"
        fontFamily="var(--font-jetbrains-mono), monospace"
      >
        {label}
      </text>
    );
  }
  const T = 1.4; // terminal half-length
  return (
    <g stroke="var(--accent-hot)" strokeWidth="0.35">
      {horizontal ? (
        <>
          <line x1={p1} y1={at} x2={p2} y2={at} />
          <line x1={p1} y1={at - T} x2={p1} y2={at + T} />
          <line x1={p2} y1={at - T} x2={p2} y2={at + T} />
          <text x={mid} y={at - 1.8} fontSize="3" fill="var(--accent-hot)" stroke="none" textAnchor="middle" fontFamily="var(--font-jetbrains-mono), monospace">
            {label}
          </text>
        </>
      ) : (
        <>
          <line x1={at} y1={p1} x2={at} y2={p2} />
          <line x1={at - T} y1={p1} x2={at + T} y2={p1} />
          <line x1={at - T} y1={p2} x2={at + T} y2={p2} />
          <text x={at + 2} y={mid + 1} fontSize="3" fill="var(--accent-hot)" stroke="none" fontFamily="var(--font-jetbrains-mono), monospace">
            {label}
          </text>
        </>
      )}
    </g>
  );
}

const GUESS = "var(--accent-hot)";
const TRUTH = "var(--c-S)";
const AIM = "var(--accent)";

function LinearLayer({
  challenge,
  preview,
  locked,
}: {
  challenge: Extract<Challenge, { kind: "linear" }>;
  preview: Guess | null;
  locked: { guess: Guess; ev: Evaluation } | null;
}) {
  const horizontal = challenge.axis === "x"; // guess moves along x → vertical line
  const line = (v: number, color: string, dash?: string, w = 0.6) => {
    const p = v * 100;
    return horizontal ? (
      <line x1={p} y1={2} x2={p} y2={98} stroke={color} strokeWidth={w} strokeDasharray={dash} />
    ) : (
      <line x1={2} y1={p} x2={98} y2={p} stroke={color} strokeWidth={w} strokeDasharray={dash} />
    );
  };
  const previewVal = preview?.kind === "linear" ? preview.value : null;
  const guessVal = locked?.guess.kind === "linear" ? locked.guess.value : null;
  return (
    <>
      {!locked && previewVal !== null && line(previewVal, AIM, "2 2")}
      {locked && (
        <>
          {challenge.type === "optical-centre" &&
            challenge.geometric !== undefined &&
            line(challenge.geometric, "var(--ink-dim)", "1 2", 0.4)}
          {/* the erring mark fringes — the lens caught the miss */}
          {guessVal !== null && line(guessVal - 0.002, "var(--ab-red)", undefined, 0.5)}
          {guessVal !== null && line(guessVal + 0.002, "var(--ab-cyan)", undefined, 0.5)}
          {guessVal !== null && line(guessVal, GUESS)}
          {line(challenge.target, TRUTH)}
          {guessVal !== null && (
            <RedlineLinear
              horizontal={horizontal}
              a={guessVal}
              b={challenge.target}
              label={`off ${locked.ev.errorDisplay}`}
            />
          )}
        </>
      )}
    </>
  );
}

function PointLayer({
  challenge,
  preview,
  locked,
}: {
  challenge: Extract<Challenge, { kind: "point" }>;
  preview: Guess | null;
  locked: { guess: Guess; ev: Evaluation } | null;
}) {
  const b = challenge.box;
  const t = challenge.target;
  const g = locked?.guess.kind === "point" ? locked.guess : null;
  const p = preview?.kind === "point" ? preview : null;
  return (
    <>
      <rect x={b.x * 100} y={b.y * 100} width={b.w * 100} height={b.h * 100} fill="rgba(236,230,216,0.02)" stroke="var(--board-tick)" strokeWidth="0.45" />
      {/* full crosshair while aiming — a designer's cursor, not a dot */}
      {!locked && p && (
        <>
          <line x1={p.x * 100} y1={2} x2={p.x * 100} y2={98} stroke={AIM} strokeWidth="0.35" opacity="0.6" />
          <line x1={2} y1={p.y * 100} x2={98} y2={p.y * 100} stroke={AIM} strokeWidth="0.35" opacity="0.6" />
          <circle cx={p.x * 100} cy={p.y * 100} r={1.1} fill={AIM} />
        </>
      )}
      {locked && g && (
        <>
          <line x1={g.x * 100} y1={g.y * 100} x2={t.x * 100} y2={t.y * 100} stroke="var(--accent-hot)" strokeWidth="0.35" strokeDasharray="1 1.2" />
          {/* aberration fringe on the miss */}
          <circle cx={g.x * 100 - 0.25} cy={g.y * 100} r={1.5} fill="var(--ab-red)" />
          <circle cx={g.x * 100 + 0.25} cy={g.y * 100} r={1.5} fill="var(--ab-cyan)" />
          <circle cx={g.x * 100} cy={g.y * 100} r={1.5} fill={GUESS} />
          <circle cx={t.x * 100} cy={t.y * 100} r={1.7} fill="none" stroke={TRUTH} strokeWidth="0.7" />
          <circle cx={t.x * 100} cy={t.y * 100} r={0.55} fill={TRUTH} />
          <text
            x={(g.x + t.x) * 50}
            y={(g.y + t.y) * 50 - 2.4}
            fontSize="3"
            fill="var(--accent-hot)"
            textAnchor="middle"
            fontFamily="var(--font-jetbrains-mono), monospace"
          >
            off {locked.ev.errorDisplay}
          </text>
        </>
      )}
    </>
  );
}

function AngleLayer({
  challenge,
  preview,
  locked,
}: {
  challenge: Extract<Challenge, { kind: "angle" }>;
  preview: Guess | null;
  locked: { guess: Guess; ev: Evaluation } | null;
}) {
  const px = challenge.pivot.x * 100;
  const py = challenge.pivot.y * 100;
  const L = 62;
  const pt = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: px + Math.cos(rad) * r, y: py - Math.sin(rad) * r };
  };
  const ray = (deg: number, color: string, w = 0.6, dash?: string) => {
    const e = pt(deg, L);
    return <line x1={px} y1={py} x2={e.x} y2={e.y} stroke={color} strokeWidth={w} strokeDasharray={dash} />;
  };
  const pv = preview?.kind === "angle" ? preview.deg : null;
  const gv = locked?.guess.kind === "angle" ? locked.guess.deg : null;
  return (
    <>
      {/* baseline */}
      {ray(0, "var(--ink-dim)", 0.45, "2 2")}
      <circle cx={px} cy={py} r={1.2} fill="var(--ink)" />
      {!locked && pv !== null && ray(pv, AIM)}
      {locked && gv !== null && (
        <>
          {ray(gv - 0.5, "var(--ab-red)", 0.45)}
          {ray(gv + 0.5, "var(--ab-cyan)", 0.45)}
          {ray(gv, GUESS)}
          {ray(challenge.targetDeg, TRUTH)}
          {/* redline arc between guess and truth, spec label at its middle */}
          {(() => {
            const a = Math.min(gv, challenge.targetDeg);
            const b = Math.max(gv, challenge.targetDeg);
            const R = 30;
            const p1 = pt(a, R);
            const p2 = pt(b, R);
            const mid = pt((a + b) / 2, R + 5.5);
            return (
              <>
                {b - a > 0.5 && (
                  <path
                    d={`M ${p1.x} ${p1.y} A ${R} ${R} 0 0 0 ${p2.x} ${p2.y}`}
                    fill="none"
                    stroke="var(--accent-hot)"
                    strokeWidth="0.35"
                  />
                )}
                <text
                  x={mid.x}
                  y={mid.y}
                  fontSize="3"
                  fill="var(--accent-hot)"
                  textAnchor="middle"
                  fontFamily="var(--font-jetbrains-mono), monospace"
                >
                  off {locked.ev.errorDisplay}
                </text>
              </>
            );
          })()}
        </>
      )}
    </>
  );
}
