"use client";

import { useEffect, useRef, useState } from "react";

interface SessionTimerProps {
  /** When true, the timer ticks. When false, it pauses. */
  running: boolean;
  /** Bumping this resets the timer to 0 (e.g. on game restart). */
  resetKey: number;
}

export function SessionTimer({ running, resetKey }: SessionTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const lastTickRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Reset on key change via state-during-render (the React-sanctioned way to
  // derive a reset from a prop, avoiding an extra effect pass).
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setElapsedMs(0);
  }

  useEffect(() => {
    if (!running) {
      lastTickRef.current = null;
      return;
    }
    const tick = (t: number) => {
      const prev = lastTickRef.current;
      if (prev != null) setElapsedMs((e) => e + (t - prev));
      lastTickRef.current = t;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  const seconds = Math.floor(elapsedMs / 1000);
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");

  return (
    <div className="flex items-center gap-2">
      <span
        className="font-mono text-[9px] uppercase tracking-[0.22em]"
        style={{ color: "var(--ink-dim)" }}
      >
        session
      </span>
      <span
        className="font-display text-[14px]"
        style={{
          color: running ? "var(--ink)" : "var(--ink-dim)",
          letterSpacing: "0.16em",
          textShadow: running ? "0 0 6px rgba(245,182,81,0.18)" : "none",
        }}
      >
        {m}:{s}
      </span>
    </div>
  );
}
