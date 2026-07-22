"use client";

import { useEffect, useState } from "react";
import { bestScore, scoreTrend } from "@/lib/learning/progress";
import { Sparkline } from "./Sparkline";

/** Per-game progress footer for a hub card — best score + a trend sparkline. */
export function CardStats({ gameId, unit = "" }: { gameId: string; unit?: string }) {
  const [mounted, setMounted] = useState(false);
  const [best, setBest] = useState(0);
  const [trend, setTrend] = useState<number[]>([]);

  useEffect(() => {
    setBest(bestScore(gameId));
    setTrend(scoreTrend(gameId));
    setMounted(true);
  }, [gameId]);

  if (!mounted || trend.length === 0) return null;

  return (
    <div className="flex items-center justify-between pt-2 mt-1 border-t" style={{ borderColor: "var(--panel-border)" }}>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--ink-dim)" }}>
        best <span className="font-display" style={{ color: "var(--accent)" }}>{best.toLocaleString("en-US")}{unit}</span>
      </span>
      {trend.length >= 2 && <Sparkline values={trend} width={72} height={20} />}
    </div>
  );
}
