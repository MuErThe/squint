"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EyeballGame } from "@/app/eyeball-it/page";
import { KernGame } from "@/app/kern-combat/page";
import { ColourGame } from "@/app/colour-forge/page";
import { ThirtyCirclesSprint } from "@/components/games/ThirtyCirclesSprint";
import type { GameResult } from "@/components/arcade/GameShell";
import { Vignette, type VignetteKind } from "@/components/arcade/Vignette";
import { currentStreak, doneToday, recordToday } from "@/lib/warmup/streak";
import { playSfx, unlockAudio } from "@/lib/audio/sfx";
import { motion } from "framer-motion";
import { FocalPlane, RACK, sharpenIn } from "@/components/focal/FocalPlane";
import { Detent } from "@/components/focal/Detent";

interface Step {
  id: string;
  label: string;
  trains: string;
  unit: string;
  tint: string;
  vignette: VignetteKind;
}

const STEPS: Step[] = [
  { id: "eyeball-it", label: "EYEBALL IT", trains: "the trained eye", unit: "%", tint: "var(--c-S)", vignette: "eyeball" },
  { id: "kern-combat", label: "KERN COMBAT", trains: "typographic craft", unit: "%", tint: "var(--c-T)", vignette: "kern" },
  { id: "colour-forge", label: "COLOUR FORGE", trains: "colour perception", unit: "%", tint: "var(--c-Z)", vignette: "colour" },
  { id: "thirty-circles", label: "THIRTY CIRCLES", trains: "divergent thinking", unit: "/6", tint: "var(--c-J)", vignette: "circles" },
];

const WARMUP_ROUNDS = 2;

type Phase = "intro" | "run" | "gap" | "summary";

export default function WarmUpPage() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [stepIdx, setStepIdx] = useState(0);
  const [results, setResults] = useState<number[]>([]);
  const [streak, setStreak] = useState(0);
  const alreadyDone = useRef(false);

  useEffect(() => {
    setMounted(true);
    setStreak(currentStreak());
    alreadyDone.current = doneToday();
  }, []);

  const start = useCallback(() => {
    unlockAudio();
    setResults([]);
    setStepIdx(0);
    setPhase("run");
    playSfx("start");
  }, []);

  const stepDone = useCallback(
    (value: number) => {
      const nextResults = [...results, value];
      setResults(nextResults);
      if (stepIdx + 1 >= STEPS.length) {
        setStreak(recordToday());
        setPhase("summary");
        playSfx("clearBig");
      } else {
        setPhase("gap");
        playSfx("clear");
      }
    },
    [results, stepIdx],
  );

  const continueNext = useCallback(() => {
    setStepIdx((i) => i + 1);
    setPhase("run");
  }, []);

  const onEye = useCallback((r: GameResult) => stepDone(Number(r.meta?.acc ?? 0)), [stepDone]);
  const onKern = useCallback((r: GameResult) => stepDone(Number(r.meta?.acc ?? 0)), [stepDone]);
  const onColour = useCallback((r: GameResult) => stepDone(Number(r.meta?.acc ?? 0)), [stepDone]);
  const onCircles = useCallback((f: number) => stepDone(f), [stepDone]);

  return (
    <div className="relative flex-1 flex flex-col w-full h-screen overflow-hidden" style={{ padding: "16px 18px" }}>
      {/* Header */}
      <FocalPlane level={phase === "intro" && mounted ? 2 : 0} className="flex-1 flex flex-col min-h-0">
      <header className="shrink-0 flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="font-mono text-[9px] uppercase tracking-[0.22em] self-center transition-colors hover:text-[var(--accent)]" style={{ color: "var(--ink-dim)" }}>
            ◂ arcade
          </Link>
          <h1 className="font-display text-lg md:text-xl tracking-[0.2em] leading-none" style={{ color: "var(--ink)" }}>
            DAILY <span style={{ color: "var(--accent)" }}>WARM-UP</span>
          </h1>
        </div>
        {(phase === "run" || phase === "gap") && (
          <div className="flex items-center gap-3">
            {/* step progress strip */}
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className="inline-block rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    background: i < results.length ? s.tint : "transparent",
                    border: `1px solid ${i === stepIdx && phase === "run" ? s.tint : "var(--panel-border-strong)"}`,
                    boxShadow: i === stepIdx && phase === "run" ? `0 0 8px ${s.tint}` : "none",
                  }}
                />
              ))}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-dim)" }}>
              {STEPS[stepIdx].label} · step {stepIdx + 1}/{STEPS.length}
            </span>
          </div>
        )}
      </header>

      {/* Body */}
      <main className="flex-1 min-h-0 flex flex-col">
        {phase === "run" && stepIdx === 0 && <EyeballGame roundCount={WARMUP_ROUNDS} record={false} onFinish={onEye} />}
        {phase === "run" && stepIdx === 1 && <KernGame roundCount={WARMUP_ROUNDS} record={false} onFinish={onKern} />}
        {phase === "run" && stepIdx === 2 && <ColourGame roundCount={WARMUP_ROUNDS} record={false} onFinish={onColour} />}
        {phase === "run" && stepIdx === 3 && <ThirtyCirclesSprint onFinish={onCircles} />}

        {phase === "gap" && (
          <Interstitial done={STEPS[stepIdx]} next={STEPS[stepIdx + 1]} value={results[results.length - 1]} onContinue={continueNext} />
        )}

        {phase === "summary" && <Summary streak={streak} results={results} />}
      </main>
      </FocalPlane>

      {/* Intro overlay */}
      {phase === "intro" && mounted && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-6 py-6 overflow-y-auto" style={{ background: "rgba(14,10,20,0.55)" }}>
          <Link href="/" className="fixed top-4 left-4 z-[55] font-mono text-[10px] uppercase tracking-[0.24em] px-3 py-2 rounded-[2px] border hover:-translate-y-px transition-transform" style={{ borderColor: "var(--panel-border-strong)", color: "var(--ink-dim)", background: "rgba(0,0,0,0.35)" }}>
            ◂ arcade
          </Link>
          <div className="panel-bg relative rounded-[2px] border w-full overflow-hidden" style={{ maxWidth: 520, borderColor: "var(--panel-border-strong)", boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}>
            <div className="px-8 py-7">
              <div className="font-display text-[10px] tracking-[0.32em] mb-2 text-center" style={{ color: "var(--accent)" }}>
                ─── five-minute ritual ───
              </div>
              <h2 className="font-display tracking-[0.14em] leading-[0.95] mb-3 text-center" style={{ color: "var(--ink)", fontSize: "clamp(28px, 6vw, 44px)" }}>
                DAILY <span style={{ color: "var(--accent)" }}>WARM-UP</span>
              </h2>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] leading-relaxed text-center mb-5" style={{ color: "var(--ink-dim)" }}>
                one quick round of each game — eye, type, colour, imagination. five minutes before you open the real work.
              </p>

              <div className="flex flex-col gap-1.5 mb-5">
                {STEPS.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--ink-dim)" }}>
                    <span style={{ color: s.tint }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ color: "var(--ink)" }}>{s.label}</span>
                    <span>· {s.trains}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-2 mb-5 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: streak > 0 ? "var(--accent)" : "var(--ink-dim)" }}>
                {streak > 0 ? <>🔥 day {streak} streak {alreadyDone.current && "· done today ✓"}</> : "start your streak today"}
              </div>

              <Detent onClick={start} className="font-display tracking-[0.24em] text-sm px-6 py-3.5 border w-full transition-all duration-150 hover:bg-[rgba(245,182,81,0.22)]" style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(245,182,81,0.1)", boxShadow: "0 0 24px rgba(245,182,81,0.18)" }}>
                ▶ START WARM-UP
              </Detent>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Interstitial({ done, next, value, onContinue }: { done: Step; next: Step; value: number; onContinue: () => void }) {
  return (
    <motion.div initial={sharpenIn.initial} animate={sharpenIn.animate} transition={RACK} className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
      <div className="font-display text-[12px] tracking-[0.28em]" style={{ color: done.tint }}>
        ✓ {done.label} · {value}{done.unit}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--ink-dim)" }}>next up</div>
      <div
        className="rounded-[2px] border overflow-hidden"
        style={{ width: 260, borderColor: "var(--panel-border-strong)" }}
      >
        <Vignette kind={next.vignette} tint={next.tint} />
      </div>
      <div className="font-display tracking-[0.14em]" style={{ color: "var(--ink)", fontSize: "clamp(24px, 5vw, 38px)" }}>
        {next.label}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: next.tint }}>{next.trains}</div>
      <Detent onClick={onContinue} autoFocus className="font-display tracking-[0.24em] text-[13px] px-8 py-3 border transition-all duration-150 hover:bg-[rgba(245,182,81,0.2)]" style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(245,182,81,0.1)" }}>
        CONTINUE ▸
      </Detent>
    </motion.div>
  );
}

function Summary({ streak, results }: { streak: number; results: number[] }) {
  const bestIdx = results.reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex items-start justify-center py-2">
      <motion.div initial={sharpenIn.initial} animate={sharpenIn.animate} transition={RACK} className="w-full" style={{ maxWidth: 520 }}>
        <div className="text-center">
          <div className="font-display text-[10px] tracking-[0.32em] mb-3" style={{ color: "var(--accent)" }}>─── warm-up complete ───</div>
          <div className="font-display leading-none mb-1" style={{ color: "var(--accent)", fontSize: 52, textShadow: "0 0 18px rgba(245,182,81,0.4)" }}>
            🔥 {streak}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] mb-6" style={{ color: "var(--ink-dim)" }}>
            day streak
          </div>

          <div className="grid grid-cols-4 gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className="flex flex-col items-center justify-center rounded-[2px] border py-3"
                style={{
                  borderColor: i === bestIdx ? s.tint : "var(--panel-border)",
                  background: i === bestIdx ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                  boxShadow: i === bestIdx ? `inset 0 2px 0 ${s.tint}` : "none",
                }}
              >
                <span className="font-mono text-[8px] uppercase tracking-[0.16em]" style={{ color: s.tint }}>{s.label.split(" ")[0]}</span>
                <span className="font-display" style={{ color: "var(--ink)", fontSize: 18 }}>{results[i] ?? 0}<span style={{ fontSize: 11, color: "var(--ink-dim)" }}>{s.unit}</span></span>
              </div>
            ))}
          </div>

          <p className="font-mono text-[11px] leading-snug mb-6 px-2" style={{ color: "var(--ink)" }}>
            Sharpest today: <span style={{ color: "var(--accent)" }}>{STEPS[bestIdx].label}</span>. The mind&apos;s warm — go make something. Come back tomorrow to keep the flame.
          </p>

          <Link href="/" className="inline-block font-display tracking-[0.24em] text-sm px-8 py-3 border transition-all duration-150 hover:bg-[rgba(245,182,81,0.22)]" style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(245,182,81,0.1)" }}>
            ← BACK TO ARCADE
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
