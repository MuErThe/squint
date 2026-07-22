"use client";

import { AnimatePresence, motion } from "framer-motion";

interface RoundRevealProps {
  show: boolean;
  points: number;
  maxPoints: number;
  /** e.g. "you: 0.54 · true: 0.50 · off by 4%". */
  detail: string;
  /** The design principle matched to the mistake — this is the lesson. */
  principle: string;
  isLast: boolean;
  onContinue: () => void;
  /** Rail-friendly: stacked layout, tighter spacing, no own panel chrome. */
  compact?: boolean;
}

/**
 * The teach-back panel shown after every round. The truth-vs-guess visual is
 * drawn on the play surface by the game itself; this panel carries the score,
 * the error, and the matched micro-lesson.
 */
export function RoundReveal({
  show,
  points,
  maxPoints,
  detail,
  principle,
  isLast,
  onContinue,
  compact = false,
}: RoundRevealProps) {
  const pct = Math.round((points / maxPoints) * 100);
  const tone =
    pct >= 85 ? "var(--c-S)" : pct >= 50 ? "var(--accent)" : "var(--accent-hot)";
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={
            compact
              ? "flex flex-col gap-3"
              : "panel-bg rounded-[2px] border px-5 py-4 flex flex-col gap-3"
          }
          style={compact ? undefined : { borderColor: "var(--panel-border-strong)" }}
        >
          <div
            className={
              compact
                ? "flex flex-col gap-1"
                : "flex items-center justify-between gap-4"
            }
          >
            <div className="flex items-baseline gap-2">
              <motion.span
                key={`${points}-${detail}`}
                initial={{ scale: 1.25 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="font-display leading-none"
                style={{ color: tone, fontSize: compact ? 30 : 26 }}
              >
                +{points}
              </motion.span>
              <span
                className="font-mono text-[9px] uppercase tracking-[0.22em]"
                style={{ color: "var(--ink-dim)" }}
              >
                / {maxPoints}
              </span>
            </div>
            <span
              className="font-mono text-[10px] tracking-[0.1em] leading-relaxed"
              style={{ color: "var(--ink-dim)" }}
            >
              {detail}
            </span>
          </div>

          {principle && (
            <div
              className="flex items-start gap-2 rounded-[2px] px-3 py-2"
              style={{
                background: "rgba(245,182,81,0.06)",
                border: "1px solid var(--panel-border)",
              }}
            >
              <span
                className="font-display text-[10px] mt-px"
                style={{ color: "var(--accent)" }}
              >
                ✦
              </span>
              <p
                className="font-mono text-[11px] leading-snug"
                style={{ color: "var(--ink)" }}
              >
                {principle}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onContinue}
            autoFocus
            className="font-display tracking-[0.24em] text-[12px] px-6 py-2.5 border w-full transition-all duration-150 hover:bg-[rgba(245,182,81,0.18)]"
            style={{
              borderColor: "var(--accent)",
              color: "var(--accent)",
              background: "rgba(245,182,81,0.08)",
            }}
          >
            {isLast ? "SEE RESULTS ▸" : "NEXT ▸"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
