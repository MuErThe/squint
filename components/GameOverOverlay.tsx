"use client";

import { AnimatePresence, motion } from "framer-motion";
import { RACK, sharpenIn } from "@/components/focal/FocalPlane";
import { Detent } from "@/components/focal/Detent";
import { Leaderboard } from "./Leaderboard";
import type {
  LeaderboardRow,
  MetaColumn,
  SubmitError,
} from "@/lib/leaderboard/api";
import type { StoredBest } from "@/lib/leaderboard/local";

export type SubmissionStatus =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "ok" }
  | { state: "skipped" } // no backend configured
  | { state: "error"; error: SubmitError; message?: string };

interface GameOverOverlayProps {
  show: boolean;
  score: number;
  lines: number;
  level: number;
  playerName: string | null;
  newBest: boolean;
  personalBest: StoredBest | null;
  submission: SubmissionStatus;
  leaderboard: LeaderboardRow[];
  loadingLeaderboard: boolean;
  /** Game-specific board columns rendered from each row's `meta`. */
  leaderboardColumns?: MetaColumn[];
  onRestart: () => void;
  /** Optional — when given, renders a secondary "BACK TO MENU" action. */
  onBackToMenu?: () => void;
  /** When true, the modal header reads "RUN ENDED" instead of "GAME OVER". */
  endedManually?: boolean;
}

export function GameOverOverlay({
  show,
  score,
  lines,
  level,
  playerName,
  newBest,
  personalBest,
  submission,
  leaderboard,
  loadingLeaderboard,
  leaderboardColumns,
  onRestart,
  onBackToMenu,
  endedManually = false,
}: GameOverOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-40 flex items-center justify-center px-6 py-6 overflow-y-auto"
          style={{
            background: "rgba(14,10,20,0.72)",
          }}
        >
          <motion.div
            initial={sharpenIn.initial}
            animate={sharpenIn.animate}
            exit={sharpenIn.exit}
            transition={RACK}
            className="panel-bg relative rounded-[2px] border max-w-[560px] w-full overflow-hidden"
            style={{
              borderColor: "rgba(255,120,73,0.45)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
            }}
          >
            <div
              className="px-6 py-3 border-b font-display text-[10px] tracking-[0.32em] flex items-center justify-between"
              style={{
                borderColor: "rgba(255,120,73,0.25)",
                color: "var(--accent-hot)",
                background: "rgba(255,120,73,0.08)",
              }}
            >
              <span>
                {endedManually
                  ? "─── ejected · run ended ───"
                  : "─── stack overflow ───"}
              </span>
              <span style={{ color: "var(--ink-dim)" }}>
                {endedManually ? "stopped" : "terminated"}
              </span>
            </div>

            <div className="px-6 py-6 text-center">
              <motion.h2
                initial={{ scale: 0.85 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="font-display tracking-[0.18em] leading-none mb-1"
                style={{
                  color: "var(--accent-hot)",
                  fontSize: 36,
                  textShadow: "0 0 16px rgba(255,120,73,0.55)",
                }}
              >
                {endedManually ? "RUN ENDED" : "GAME OVER"}
              </motion.h2>
              <div
                className="font-mono text-[10px] uppercase tracking-[0.22em] mb-1"
                style={{ color: "var(--ink-dim)" }}
              >
                {playerName ? `pilot · ${playerName}` : "the well is full"}
              </div>
              {newBest && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-display text-[12px] tracking-[0.22em] mb-3"
                  style={{
                    color: "var(--accent)",
                    textShadow: "0 0 10px rgba(245,182,81,0.5)",
                  }}
                >
                  ★ new personal best ★
                </motion.div>
              )}
              {!newBest && personalBest && (
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3"
                  style={{ color: "var(--ink-dim)" }}
                >
                  personal best · {personalBest.score.toLocaleString("en-US")}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatBlock label="SCORE" value={score} hero />
                <StatBlock label="LINES" value={lines} />
                <StatBlock label="LEVEL" value={level} />
              </div>

              <SubmissionLine status={submission} />

              <div className="text-left mb-5 mt-3">
                <Leaderboard
                  rows={leaderboard}
                  loading={loadingLeaderboard}
                  highlightName={playerName}
                  columns={leaderboardColumns}
                  emptyMessage={
                    submission.state === "skipped"
                      ? "leaderboard offline · configure supabase to enable"
                      : "no scores yet · you could be first"
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Detent
                  onClick={onRestart}
                  className="font-display tracking-[0.24em] text-sm px-6 py-3.5 border w-full transition-all duration-150 hover:bg-[rgba(245,182,81,0.22)]"
                  style={{
                    borderColor: "var(--accent)",
                    color: "var(--accent)",
                    background: "rgba(245, 182, 81, 0.1)",
                    boxShadow: "0 0 20px rgba(245, 182, 81, 0.15)",
                  }}
                >
                  ↻ INSERT COIN
                </Detent>
                {onBackToMenu && (
                  <button
                    onClick={onBackToMenu}
                    className="font-mono uppercase tracking-[0.22em] text-[11px] px-6 py-2 w-full transition-colors hover:text-[var(--ink)]"
                    style={{ color: "var(--ink-dim)" }}
                  >
                    ← back to menu
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatBlock({
  label,
  value,
  hero = false,
}: {
  label: string;
  value: number;
  hero?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[2px] border py-3"
      style={{
        borderColor: hero
          ? "var(--panel-border-strong)"
          : "var(--panel-border)",
        background: hero
          ? "linear-gradient(180deg, rgba(245,182,81,0.08), rgba(245,182,81,0.02))"
          : "rgba(255,255,255,0.02)",
      }}
    >
      <span
        className="font-mono text-[9px] uppercase tracking-[0.22em]"
        style={{ color: "var(--ink-dim)" }}
      >
        {label}
      </span>
      <span
        className="font-display"
        style={{
          color: hero ? "var(--accent)" : "var(--ink)",
          fontSize: hero ? 26 : 20,
          letterSpacing: "0.04em",
          textShadow: hero ? "0 0 10px rgba(245,182,81,0.3)" : "none",
        }}
      >
        {value.toLocaleString("en-US")}
      </span>
    </div>
  );
}

function SubmissionLine({ status }: { status: SubmissionStatus }) {
  let text: string;
  let color = "var(--ink-dim)";
  switch (status.state) {
    case "idle":
      return null;
    case "submitting":
      text = "submitting score…";
      break;
    case "ok":
      text = "✓ score submitted";
      color = "var(--c-S)";
      break;
    case "skipped":
      text = "leaderboard offline · saved locally";
      break;
    case "error":
      text =
        status.error === "rate_limited"
          ? "submission rate-limited · try again in a moment"
          : status.error === "implausible_score" ||
              status.error === "implausible_time"
            ? "submission rejected by server (sanity check)"
            : status.error === "bad_token" || status.error === "unknown_name"
              ? "submission auth failed · clear name and try again"
              : `submission failed (${status.error})`;
      color = "var(--accent-hot)";
      break;
  }
  return (
    <div
      className="font-mono text-[10px] uppercase tracking-[0.22em]"
      style={{ color }}
    >
      {text}
    </div>
  );
}
