"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { PanelFrame } from "./PanelFrame";
import type { PieceType } from "@/lib/tetris/types";
import { PIECE_COLORS_HEX } from "@/lib/render/palette";
import type { StoredBest } from "@/lib/leaderboard/local";

const NextPiecePreview = dynamic(
  () => import("./NextPiecePreview").then((m) => m.NextPiecePreview),
  { ssr: false },
);

interface ScorePanelProps {
  score: number;
  lines: number;
  level: number;
  queue: PieceType[];
  /** If present, displayed as a tiny "personal best" chip. */
  personalBest?: StoredBest | null;
}

export function ScorePanel({
  score,
  lines,
  level,
  queue,
  personalBest,
}: ScorePanelProps) {
  const linesIntoLevel = lines % 10;
  const progress = linesIntoLevel / 10;

  return (
    <PanelFrame label="SCORE" hint="run · live">
      {/* Hero score */}
      <div className="flex items-end justify-between mb-3">
        <div className="flex flex-col">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--ink-dim)" }}
          >
            points
          </span>
          <motion.span
            key={score}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="font-display leading-none"
            style={{
              color: "var(--accent)",
              fontSize: 44,
              textShadow:
                "0 0 12px rgba(245,182,81,0.32), 0 2px 0 rgba(0,0,0,0.55)",
            }}
          >
            {formatScore(score)}
          </motion.span>
        </div>
        <LevelBadge level={level} />
      </div>

      {/* Sub stats */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <Stat label="LINES" value={lines} />
        <Stat label="L · NEXT" value={10 - linesIntoLevel} subtle />
      </div>

      {/* Personal best chip */}
      {personalBest && personalBest.score > 0 && (
        <div
          className="flex items-center justify-between mb-3 px-2 py-1 rounded-[2px]"
          style={{
            background: "rgba(245,182,81,0.06)",
            border: "1px solid var(--panel-border)",
          }}
        >
          <span
            className="font-mono text-[9px] uppercase tracking-[0.22em]"
            style={{ color: "var(--ink-dim)" }}
          >
            personal best
          </span>
          <span
            className="font-display text-[13px]"
            style={{
              color:
                score > personalBest.score ? "var(--accent)" : "var(--ink)",
              letterSpacing: "0.06em",
            }}
          >
            {personalBest.score.toLocaleString("en-US")}
          </span>
        </div>
      )}

      {/* Level progress meter */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span
            className="font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: "var(--ink-dim)" }}
          >
            level progress
          </span>
          <span
            className="font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: "var(--ink-dim)" }}
          >
            {linesIntoLevel}/10
          </span>
        </div>
        <div
          className="h-1.5 w-full rounded-[1px] overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <motion.div
            className="h-full"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            style={{
              background:
                "linear-gradient(90deg, var(--accent), var(--accent-hot))",
              boxShadow: "0 0 6px rgba(245,182,81,0.5)",
            }}
          />
        </div>
      </div>

      {/* Next queue */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="font-display text-[10px] tracking-[0.22em]"
          style={{ color: "var(--accent)" }}
        >
          NEXT
        </span>
        <div className="flex-1 dashed-rule" />
        <span
          className="font-mono text-[9px] uppercase tracking-[0.18em]"
          style={{ color: "var(--ink-dim)" }}
        >
          ×3
        </span>
      </div>
      <div className="flex gap-2 items-end">
        <AnimatePresence initial={false} mode="popLayout">
          {queue.map((t, i) => {
            const dim = i === 0 ? 86 : 60;
            return (
              <motion.div
                key={`${i}-${t}`}
                layout
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="relative"
                style={{ color: PIECE_COLORS_HEX[t] }}
              >
                <NextPiecePreview piece={t} size={dim} prominent={i === 0} />
                <span
                  className="absolute bottom-1 right-1.5 font-display text-[10px]"
                  style={{
                    color: PIECE_COLORS_HEX[t],
                    opacity: 0.55,
                    letterSpacing: "0.1em",
                  }}
                >
                  {t}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </PanelFrame>
  );
}

function Stat({
  label,
  value,
  subtle = false,
}: {
  label: string;
  value: number;
  subtle?: boolean;
}) {
  return (
    <div
      className="flex items-baseline justify-between border-l-2 pl-2"
      style={{
        borderColor: subtle ? "var(--panel-border)" : "var(--accent)",
      }}
    >
      <span
        className="font-mono text-[9px] uppercase tracking-[0.18em]"
        style={{ color: "var(--ink-dim)" }}
      >
        {label}
      </span>
      <motion.span
        key={value}
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="font-display"
        style={{
          color: subtle ? "var(--ink-dim)" : "var(--ink)",
          fontSize: 18,
        }}
      >
        {value}
      </motion.span>
    </div>
  );
}

function LevelBadge({ level }: { level: number }) {
  return (
    <motion.div
      key={level}
      initial={{ scale: 0.85, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col items-center justify-center rounded-[2px] border"
      style={{
        width: 60,
        height: 60,
        borderColor: "var(--panel-border-strong)",
        background:
          "linear-gradient(180deg, rgba(245,182,81,0.06), rgba(245,182,81,0.02))",
      }}
    >
      <span
        className="font-mono text-[8px] uppercase tracking-[0.22em]"
        style={{ color: "var(--ink-dim)" }}
      >
        lvl
      </span>
      <span
        className="font-display leading-none"
        style={{
          color: "var(--ink)",
          fontSize: 28,
          textShadow: "0 0 10px rgba(245,182,81,0.25)",
        }}
      >
        {level}
      </span>
    </motion.div>
  );
}

function formatScore(n: number): string {
  // Comma group every 3 digits, monospace look
  return n.toLocaleString("en-US");
}
