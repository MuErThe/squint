"use client";

import { useEffect, useRef, useState } from "react";
import type { GestureState } from "@/lib/hand/types";
import { COLS } from "@/lib/tetris/types";

interface PinchMeterProps {
  gestureRef: React.MutableRefObject<GestureState>;
}

// Renders a thin vertical bar showing how close to a pinch the user is.
// 0 = open hand, 1 = fully pinched.
export function PinchMeter({ gestureRef }: PinchMeterProps) {
  const [pinch01, setPinch01] = useState(0);
  const [col, setCol] = useState(4);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      const g = gestureRef.current;
      // Map normalized pinch [0.55 .. 0.25] → [0 .. 1]
      const n = g.normalizedPinch;
      const v = clamp01((0.55 - n) / 0.3);
      setPinch01((prev) => prev + (v - prev) * 0.25);
      setCol(g.targetColumn);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [gestureRef]);

  return (
    <div className="flex items-stretch gap-3 w-full">
      {/* Pinch vertical bar */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="font-mono text-[8px] uppercase tracking-[0.18em]"
          style={{ color: "var(--ink-dim)" }}
        >
          pinch
        </span>
        <div
          className="relative w-2 rounded-[1px] overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.05)",
            height: 56,
          }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 transition-[height] ease-out duration-100"
            style={{
              height: `${pinch01 * 100}%`,
              background:
                pinch01 > 0.78
                  ? "linear-gradient(180deg, var(--accent-hot), #f4592a)"
                  : "linear-gradient(180deg, var(--accent), #c9882f)",
              boxShadow:
                pinch01 > 0.78
                  ? "0 0 8px rgba(255,120,73,0.55)"
                  : "0 0 4px rgba(245,182,81,0.4)",
            }}
          />
          {/* Threshold tick */}
          <div
            className="absolute left-0 right-0 h-px"
            style={{
              bottom: "78%",
              background: "rgba(255,120,73,0.45)",
            }}
          />
        </div>
      </div>

      {/* Column indicator — one tick per playfield column */}
      <div className="flex flex-col flex-1 gap-1">
        <div className="flex items-center justify-between">
          <span
            className="font-mono text-[8px] uppercase tracking-[0.18em]"
            style={{ color: "var(--ink-dim)" }}
          >
            target column
          </span>
          <span
            className="font-display text-[12px]"
            style={{ color: "var(--accent)" }}
          >
            {String(col).padStart(2, "0")}
          </span>
        </div>
        <div className="flex gap-[2px]">
          {Array.from({ length: COLS }, (_, i) => (
            <div
              key={i}
              className="flex-1 transition-colors duration-100 rounded-[1px]"
              style={{
                height: 8,
                background:
                  i === col
                    ? "var(--accent)"
                    : Math.abs(i - col) === 1
                      ? "rgba(245,182,81,0.35)"
                      : "rgba(255,255,255,0.05)",
                boxShadow:
                  i === col ? "0 0 6px rgba(245,182,81,0.55)" : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
