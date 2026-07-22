"use client";

import { motion } from "framer-motion";

interface RoundDotsProps {
  total: number;
  /** Index of the round in progress (0-based). */
  current: number;
  /** Points per completed round, as a fraction of max (0..1). */
  results: number[];
  /** The game's accent colour (CSS value). */
  accent: string;
}

/** One dot per round: done dots are tinted by how well the round went. */
export function RoundDots({ total, current, results, accent }: RoundDotsProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {Array.from({ length: total }, (_, i) => {
        const done = i < results.length;
        const active = i === current && !done;
        const quality = done ? results[i] : 0;
        const colour = done
          ? quality >= 0.8
            ? "var(--c-S)"
            : quality >= 0.4
              ? "var(--accent)"
              : "var(--accent-hot)"
          : "transparent";
        return (
          <motion.span
            key={i}
            initial={false}
            animate={{ scale: done ? [1.5, 1] : 1 }}
            transition={{ duration: 0.25 }}
            className="inline-block rounded-full"
            style={{
              width: 8,
              height: 8,
              background: colour,
              border: `1px solid ${done ? colour : active ? accent : "var(--panel-border-strong)"}`,
              boxShadow: active ? `0 0 8px ${accent}` : "none",
              animation: active ? "vg-dot 1.6s linear infinite" : "none",
            }}
          />
        );
      })}
    </div>
  );
}
