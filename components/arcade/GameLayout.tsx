"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { PanelFrame } from "@/components/PanelFrame";
import { RoundDots } from "./RoundDots";
import { FocalPlane } from "@/components/focal/FocalPlane";

interface GameLayoutProps {
  /** Current challenge-type label, e.g. "BISECT" — the playfield panel label. */
  typeLabel: string;
  roundIdx: number;
  roundCount: number;
  score: number;
  /** The instruction for the current round. */
  prompt: string;
  /** Game accent colour (CSS value, e.g. "var(--c-S)"). */
  accent: string;
  /** Per-round quality so far, each 0..1 — drives the round dots. */
  results: number[];
  /** Rail content once a round is locked (compact RoundReveal); null while aiming. */
  reveal: ReactNode | null;
  /** Optional action under the surface (e.g. LOCK IT IN). */
  action?: ReactNode;
  /** The play surface. */
  children: ReactNode;
}

/**
 * Shared two-column game grammar: the play surface mounted in a PanelFrame
 * ("the artboard in the cabinet") with a right rail carrying session progress
 * and the teach-back reveal. Single column on narrow screens.
 */
export function GameLayout({
  typeLabel,
  roundIdx,
  roundCount,
  score,
  prompt,
  accent,
  results,
  reveal,
  action,
  children,
}: GameLayoutProps) {
  return (
    <div className="game-cols flex-1">
      {/* Playfield */}
      <PanelFrame
        label={typeLabel}
        hint={`round ${roundIdx + 1} / ${roundCount}`}
        rightSlot={
          <span
            className="font-mono text-[9px] uppercase tracking-[0.2em]"
            style={{ color: "var(--ink-dim)" }}
          >
            score{" "}
            <ScoreTicker
              value={score}
              className="font-display text-[12px]"
              style={{ color: "var(--ink)" }}
            />
          </span>
        }
        className="flex flex-col min-h-0"
        contentClassName="flex-1 flex flex-col gap-3 min-h-0"
      >
        <p
          className="shrink-0 font-mono text-[12px] text-center tracking-[0.04em]"
          style={{ color: "var(--ink)" }}
        >
          {prompt}
        </p>
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
        {action && <div className="shrink-0">{action}</div>}
      </PanelFrame>

      {/* Rail — peripheral (fz-1) while aiming; racks sharp when the reveal
          lands. The playfield itself never defocuses: the teach-back marks
          are drawn on it, and you don't blur the evidence. */}
      <FocalPlane level={reveal ? 0 : 1} className="flex flex-col gap-3 min-h-0">
        <PanelFrame label="SESSION" hint="this run">
          <div className="flex flex-col gap-3">
            <RoundDots
              total={roundCount}
              current={roundIdx}
              results={results}
              accent={accent}
            />
            <div className="flex items-baseline justify-between">
              <span
                className="font-mono text-[9px] uppercase tracking-[0.22em]"
                style={{ color: "var(--ink-dim)" }}
              >
                score
              </span>
              <ScoreTicker
                value={score}
                className="font-display text-[22px] leading-none"
                style={{ color: accent }}
              />
            </div>
          </div>
        </PanelFrame>

        <PanelFrame
          label="REVEAL"
          hint="the lesson lives here"
          className="flex-1 min-h-0"
          contentClassName="min-h-0 overflow-y-auto"
        >
          {reveal ?? (
            <div
              className="py-6 text-center font-mono text-[10px] uppercase tracking-[0.22em] leading-relaxed"
              style={{ color: "var(--ink-dim)", opacity: 0.7 }}
            >
              make your call —<br />
              the truth appears here
            </div>
          )}
        </PanelFrame>
      </FocalPlane>
    </div>
  );
}

/** Number that ticks up smoothly when its value changes. */
function ScoreTicker({
  value,
  className,
  style,
}: {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(value);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prevRef.current;
    prevRef.current = value;
    if (reduced || from === value) {
      el.textContent = value.toLocaleString("en-US");
      return;
    }
    const controls = animate(from, value, {
      duration: 0.5,
      ease: "easeOut",
      onUpdate: (v) => {
        el.textContent = Math.round(v).toLocaleString("en-US");
      },
    });
    return () => controls.stop();
  }, [value, reduced]);

  return (
    <span ref={ref} className={className} style={style}>
      {value.toLocaleString("en-US")}
    </span>
  );
}
