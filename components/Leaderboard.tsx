"use client";

import { motion } from "framer-motion";
import type { LeaderboardRow, MetaColumn } from "@/lib/leaderboard/api";

interface LeaderboardProps {
  rows: LeaderboardRow[];
  loading: boolean;
  /** Player name to visually highlight if present in the board. */
  highlightName?: string | null;
  /** Status text shown when there's nothing meaningful to display. */
  emptyMessage?: string;
  /** Extra game-specific columns rendered after the score, from row `meta`. */
  columns?: MetaColumn[];
  /** Header label. */
  title?: string;
}

export function Leaderboard({
  rows,
  loading,
  highlightName,
  emptyMessage = "no scores yet · you could be first",
  columns = [],
  title = "LEADERBOARD ─ ALL TIME · TOP 10",
}: LeaderboardProps) {
  const highlight = highlightName?.toLowerCase();
  // Grid: rank · name (flex) · score · [each meta column].
  const gridTemplateColumns = [
    "32px",
    "1fr",
    "64px",
    ...columns.map((c) => `${c.width ?? 48}px`),
  ].join(" ");
  return (
    <div
      className="rounded-[2px] border overflow-hidden"
      style={{ borderColor: "var(--panel-border)" }}
    >
      <div
        className="px-3 py-2 flex items-center justify-between border-b"
        style={{
          borderColor: "var(--panel-border)",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <span
          className="font-display text-[10px] tracking-[0.22em]"
          style={{ color: "var(--accent)" }}
        >
          {title}
        </span>
        {loading && (
          <span
            className="font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: "var(--ink-dim)" }}
          >
            syncing…
          </span>
        )}
      </div>

      {rows.length === 0 && !loading ? (
        <div
          className="px-3 py-6 text-center font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "var(--ink-dim)" }}
        >
          {emptyMessage}
        </div>
      ) : (
        <div className="font-mono text-[12px]">
          <div
            className="grid px-3 py-1.5 border-b text-[9px] uppercase tracking-[0.22em]"
            style={{
              borderColor: "var(--panel-border)",
              color: "var(--ink-dim)",
              gridTemplateColumns,
            }}
          >
            <span>#</span>
            <span>name</span>
            <span className="text-right">score</span>
            {columns.map((c) => (
              <span key={c.label} className="text-right">
                {c.label}
              </span>
            ))}
          </div>
          {rows.map((r) => {
            const isMe =
              highlight && r.name.toLowerCase() === highlight;
            return (
              <motion.div
                key={`${r.rank}-${r.name}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="grid px-3 py-1.5"
                style={{
                  background: isMe
                    ? "linear-gradient(90deg, rgba(245,182,81,0.18), rgba(245,182,81,0.04))"
                    : "transparent",
                  color: isMe ? "var(--accent)" : "var(--ink)",
                  gridTemplateColumns,
                  boxShadow: isMe
                    ? "inset 2px 0 0 var(--accent)"
                    : "inset 2px 0 0 transparent",
                }}
              >
                <span
                  className="font-display"
                  style={{ color: rankColor(r.rank, !!isMe) }}
                >
                  {String(r.rank).padStart(2, "0")}
                </span>
                <span className="truncate font-display tracking-[0.05em]">
                  {r.name}
                  {isMe && (
                    <span
                      className="ml-1 font-mono text-[9px] uppercase"
                      style={{ color: "var(--accent)" }}
                    >
                      · you
                    </span>
                  )}
                </span>
                <span className="text-right font-display">
                  {r.score.toLocaleString("en-US")}
                </span>
                {columns.map((c) => (
                  <span
                    key={c.label}
                    className="text-right"
                    style={{ color: "var(--ink-dim)" }}
                  >
                    {c.get(r.meta)}
                  </span>
                ))}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function rankColor(rank: number, isMe: boolean): string {
  if (isMe) return "var(--accent)";
  if (rank === 1) return "var(--accent)";
  if (rank === 2) return "var(--ink)";
  if (rank === 3) return "var(--accent-hot)";
  return "var(--ink-dim)";
}
