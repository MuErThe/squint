"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { currentStreak, doneToday } from "@/lib/warmup/streak";
import { Vignette } from "./Vignette";

/** Bento tile: the daily-warm-up call to action + current streak flame. */
export function WarmUpBanner() {
  const [mounted, setMounted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setStreak(currentStreak());
    setDone(doneToday());
    setMounted(true);
  }, []);

  return (
    <Link
      href="/warm-up"
      className="bento-card group panel-bg rounded-[2px] overflow-hidden flex items-stretch"
      style={{ "--tint": "var(--accent)", gridArea: "warmup" } as React.CSSProperties}
    >
      <div className="shrink-0 hidden sm:block" style={{ width: 132 }}>
        <Vignette kind="warmup" tint="var(--accent)" className="h-full" />
      </div>
      <div className="flex-1 flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[13px] tracking-[0.2em]" style={{ color: "var(--ink)" }}>
            DAILY <span style={{ color: "var(--accent)" }}>WARM-UP</span>
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-dim)" }}>
            one round of each · five minutes · before the real work
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {mounted && streak > 0 && (
            <div className="flex flex-col items-end leading-tight">
              <span className="font-display text-[16px]" style={{ color: "var(--accent)" }}>
                🔥 {streak}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-dim)" }}>
                day streak{done ? " · done ✓" : ""}
              </span>
            </div>
          )}
          <span
            className="font-display text-[11px] tracking-[0.22em] px-3.5 py-2 rounded-[2px] border transition-colors group-hover:bg-[rgba(245,182,81,0.16)]"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            {mounted && done ? "AGAIN ▸" : "START ▸"}
          </span>
        </div>
      </div>
    </Link>
  );
}
