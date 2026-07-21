"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Leaderboard } from "@/components/Leaderboard";
import { LeaderboardModal } from "@/components/LeaderboardModal";
import { SessionTimer } from "@/components/SessionTimer";
import { PanelFrame } from "@/components/PanelFrame";
import { Sparkline } from "./Sparkline";
import { Vignette, type VignetteKind } from "./Vignette";
import {
  fetchTop10,
  submitScore,
  type LeaderboardRow,
  type MetaColumn,
  type SubmitError,
} from "@/lib/leaderboard/api";
import { leaderboardConfigured } from "@/lib/leaderboard/supabase";
import { resolveIdentity } from "@/lib/leaderboard/identity";
import { loadStoredPlayer, type StoredPlayer } from "@/lib/leaderboard/local";
import { NAME_RULES } from "@/lib/leaderboard/profanity";
import { generateRandomName } from "@/lib/leaderboard/random-name";
import { bestScore, scoreTrend } from "@/lib/learning/progress";
import { playSfx, unlockAudio } from "@/lib/audio/sfx";

export interface StatItem {
  label: string;
  value: string | number;
  hero?: boolean;
}

/** What a game hands back when a session ends. GameShell owns play-time + submit. */
export interface GameResult {
  score: number;
  meta?: Record<string, unknown>;
  stats: StatItem[];
  /** Optional flavour headline, e.g. "SHARP EYE". */
  headline?: string;
}

interface GamePlayContext {
  onFinish: (result: GameResult) => void;
  quit: () => void;
  player: StoredPlayer;
}

interface GameShellProps {
  gameId: string;
  /** Wordmark shown on the start card and in the header. */
  title: ReactNode;
  /** The skill it trains (short). */
  trains: string;
  /** One-line what/why pitch. */
  pitch: string;
  /** How to play, a few short lines. */
  howTo?: string[];
  /** Leaderboard columns derived from each row's meta. */
  columns?: MetaColumn[];
  eyebrow?: string;
  countNoun?: string;
  /** The game's living preview, shown on the start card. */
  vignette?: VignetteKind;
  /** The game's accent colour (CSS value) — tints the start card. */
  accent?: string;
  /** Mounts the game during play; receives finish/quit callbacks. */
  children: (ctx: GamePlayContext) => ReactNode;
}

type SubmissionStatus =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "ok" }
  | { state: "skipped" }
  | { state: "error"; error: SubmitError; message?: string };

export function GameShell({
  gameId,
  title,
  trains,
  pitch,
  howTo = [],
  columns = [],
  eyebrow = "hall of fame",
  countNoun = "players",
  vignette,
  accent = "var(--accent)",
  children,
}: GameShellProps) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"start" | "playing" | "over">("start");
  const [runKey, setRunKey] = useState(0);

  const [name, setName] = useState("");
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);

  const [result, setResult] = useState<GameResult | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [submission, setSubmission] = useState<SubmissionStatus>({ state: "idle" });
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);

  const runStartRef = useRef(0);
  const prevBestRef = useRef(0);
  const lbOnline = leaderboardConfigured();

  useEffect(() => {
    const stored = loadStoredPlayer();
    setPlayer(stored);
    setName(stored?.name ?? "");
    setMounted(true);
  }, []);

  const trend = mounted ? scoreTrend(gameId) : [];
  const best = mounted ? bestScore(gameId) : 0;

  const beginPlay = useCallback(() => {
    prevBestRef.current = bestScore(gameId);
    runStartRef.current = performance.now();
    setResult(null);
    setSubmission({ state: "idle" });
    setNewBest(false);
    setRunKey((k) => k + 1);
    setPhase("playing");
    playSfx("start");
  }, [gameId]);

  const handleStart = useCallback(async () => {
    setBusy(true);
    setError(null);
    unlockAudio();
    try {
      const res = await resolveIdentity(name);
      if (!res.ok) {
        setError(res.error);
        setName(res.name);
        return;
      }
      setName(res.name);
      setPlayer(res.player);
      beginPlay();
    } finally {
      setBusy(false);
    }
  }, [name, beginPlay]);

  const refreshBoard = useCallback(async () => {
    if (!lbOnline) return;
    setLoadingBoard(true);
    try {
      setBoard(await fetchTop10(gameId));
    } finally {
      setLoadingBoard(false);
    }
  }, [gameId, lbOnline]);

  const handleFinish = useCallback(
    (r: GameResult) => {
      const playTimeMs = Math.max(0, performance.now() - runStartRef.current);
      setResult(r);
      setNewBest(r.score > prevBestRef.current);
      setPhase("over");
      playSfx("gameOver");
      void refreshBoard();

      if (!player || player.token === "local" || !lbOnline) {
        setSubmission({ state: "skipped" });
        return;
      }
      if (r.score <= 0) {
        setSubmission({ state: "skipped" });
        return;
      }
      setSubmission({ state: "submitting" });
      void (async () => {
        const res = await submitScore({
          name: player.name,
          token: player.token,
          game: gameId,
          score: r.score,
          meta: r.meta ?? {},
          playTimeMs,
        });
        if (res.ok) {
          setSubmission({ state: "ok" });
          await refreshBoard();
        } else {
          setSubmission({ state: "error", error: res.error, message: res.message });
        }
      })();
    },
    [player, lbOnline, gameId, refreshBoard],
  );

  const quit = useCallback(() => setPhase("start"), []);
  const playAgain = useCallback(() => {
    if (player) beginPlay();
    else setPhase("start");
  }, [player, beginPlay]);

  return (
    <div className="relative flex-1 flex flex-col w-full h-screen overflow-hidden" style={{ padding: "16px 18px" }}>
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            title="Back to the arcade"
            className="font-mono text-[9px] uppercase tracking-[0.22em] self-center transition-colors hover:text-[var(--accent)]"
            style={{ color: "var(--ink-dim)" }}
          >
            ◂ arcade
          </Link>
          <h1 className="font-display text-lg md:text-xl tracking-[0.2em] leading-none" style={{ color: "var(--ink)" }}>
            {title}
          </h1>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--ink-dim)" }}>
            {trains}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {player && phase !== "start" && (
            <span className="font-display text-[11px]" style={{ color: "var(--accent)" }}>
              {player.name}
            </span>
          )}
          <SessionTimer running={phase === "playing"} resetKey={runKey} />
          {phase === "playing" && (
            <button
              type="button"
              onClick={quit}
              className="font-display text-[10px] tracking-[0.22em] px-3 py-1.5 rounded-[2px] border transition-colors hover:bg-[rgba(255,120,73,0.14)]"
              style={{ borderColor: "var(--accent-hot)", color: "var(--accent-hot)" }}
            >
              QUIT
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 min-h-0 flex flex-col">
        {phase === "playing" && player && children({ onFinish: handleFinish, quit, player })}
        {phase === "over" && result && (
          <GameOverPanel
            result={result}
            newBest={newBest}
            personalBest={Math.max(best, result.score)}
            submission={submission}
            board={board}
            loadingBoard={loadingBoard}
            columns={columns}
            onPlayAgain={playAgain}
          />
        )}
      </main>

      {/* Start overlay */}
      <AnimatePresence>
        {phase === "start" && mounted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 flex items-center justify-center px-6 py-6 overflow-y-auto"
            style={{ background: "rgba(14,10,20,0.92)", backdropFilter: "blur(20px)" }}
          >
            <motion.div
              initial={{ y: 18, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="panel-bg relative rounded-[2px] border w-full overflow-hidden my-auto"
              style={{ maxWidth: 520, borderColor: "var(--panel-border-strong)", boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}
            >
              {vignette && (
                <div className="border-b" style={{ borderColor: "var(--panel-border)", height: 84 }}>
                  <Vignette kind={vignette} tint={accent} className="h-full" />
                </div>
              )}
              <div className="px-8 py-7">
                <div className="font-display text-[10px] tracking-[0.32em] mb-2 text-center" style={{ color: "var(--accent)" }}>
                  ─── {trains} ───
                </div>
                <h2 className="font-display tracking-[0.14em] leading-[0.95] mb-3 text-center" style={{ color: "var(--ink)", fontSize: "clamp(30px, 6vw, 46px)" }}>
                  {title}
                </h2>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] leading-relaxed text-center mb-5" style={{ color: "var(--ink-dim)" }}>
                  {pitch}
                </p>

                {howTo.length > 0 && (
                  <ul className="flex flex-col gap-1.5 mb-5">
                    {howTo.map((line, i) => (
                      <li key={i} className="flex items-start gap-2 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--ink-dim)" }}>
                        <span style={{ color: "var(--accent)" }}>{String(i + 1).padStart(2, "0")}</span>
                        {line}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Trend */}
                {trend.length >= 2 && (
                  <div className="flex items-center justify-between rounded-[2px] border px-3 py-2 mb-5" style={{ borderColor: "var(--panel-border)" }}>
                    <div className="flex flex-col">
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-dim)" }}>
                        your last {trend.length}
                      </span>
                      <span className="font-display text-[12px]" style={{ color: "var(--accent)" }}>
                        best {best.toLocaleString("en-US")}
                      </span>
                    </div>
                    <Sparkline values={trend} />
                  </div>
                )}

                {/* Name */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-display text-[10px] tracking-[0.22em]" style={{ color: "var(--accent)" }}>
                      YOUR TAG
                    </label>
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--ink-dim)" }}>
                      {name.length}/{NAME_RULES.max}
                    </span>
                  </div>
                  <div className="flex gap-2 rounded-[2px] border p-1.5" style={{ borderColor: "var(--panel-border-strong)", background: "rgba(0,0,0,0.2)" }}>
                    <input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value.slice(0, NAME_RULES.max));
                        setError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !busy) handleStart();
                      }}
                      placeholder="leave blank to auto-generate"
                      spellCheck={false}
                      autoComplete="off"
                      className="flex-1 bg-transparent outline-none font-display tracking-[0.16em] px-2"
                      style={{ color: "var(--ink)", fontSize: 16, caretColor: "var(--accent)" }}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setName(generateRandomName());
                        setError(null);
                      }}
                      className="px-3 font-display text-[10px] tracking-[0.22em] rounded-[2px] border transition-colors hover:bg-[rgba(245,182,81,0.18)]"
                      style={{ borderColor: "var(--panel-border-strong)", color: "var(--accent)" }}
                    >
                      GENERATE
                    </button>
                  </div>
                  {!lbOnline && (
                    <div className="font-mono text-[9px] uppercase tracking-[0.18em] mt-1.5" style={{ color: "var(--ink-dim)" }}>
                      ⓘ leaderboard offline · scores stay local
                    </div>
                  )}
                </div>

                {error && (
                  <div className="font-mono text-[11px] mb-4 px-3 py-2 rounded-[2px] border" style={{ borderColor: "rgba(255,120,73,0.4)", background: "rgba(255,120,73,0.08)", color: "var(--accent-hot)" }}>
                    {error}
                  </div>
                )}

                <button
                  disabled={busy}
                  onClick={handleStart}
                  className="font-display tracking-[0.24em] text-sm px-6 py-3.5 border w-full transition-all duration-150 disabled:opacity-50 hover:bg-[rgba(245,182,81,0.22)]"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(245,182,81,0.1)", boxShadow: "0 0 24px rgba(245,182,81,0.18)" }}
                >
                  {busy ? "WORKING…" : "▶ START"}
                </button>
              </div>

              {lbOnline && (
                <button
                  type="button"
                  onClick={() => setBoardOpen(true)}
                  className="w-full px-8 py-3 font-mono text-[10px] uppercase tracking-[0.22em] border-t transition-colors flex items-center justify-center gap-2 hover:bg-[rgba(245,182,81,0.08)]"
                  style={{ borderColor: "var(--panel-border)", color: "var(--ink-dim)", background: "rgba(0,0,0,0.25)" }}
                >
                  🏆 view leaderboard
                </button>
              )}
            </motion.div>

            <Link
              href="/"
              className="fixed top-4 left-4 z-[55] font-mono text-[10px] uppercase tracking-[0.24em] px-3 py-2 rounded-[2px] border transition-all duration-150 hover:-translate-y-px"
              style={{ borderColor: "var(--panel-border-strong)", color: "var(--ink-dim)", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
            >
              ◂ arcade
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <LeaderboardModal
        show={boardOpen}
        onClose={() => setBoardOpen(false)}
        game={gameId}
        columns={columns}
        eyebrow={eyebrow}
        countNoun={countNoun}
        highlightName={player?.name ?? null}
      />
    </div>
  );
}

function GameOverPanel({
  result,
  newBest,
  personalBest,
  submission,
  board,
  loadingBoard,
  columns,
  onPlayAgain,
}: {
  result: GameResult;
  newBest: boolean;
  personalBest: number;
  submission: SubmissionStatus;
  board: LeaderboardRow[];
  loadingBoard: boolean;
  columns: MetaColumn[];
  onPlayAgain: () => void;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex items-start justify-center py-2">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full"
        style={{ maxWidth: 520 }}
      >
        <PanelFrame label={result.headline ?? "RESULTS"} hint="session complete" className="flex flex-col">
          <div className="text-center pt-1">
            {newBest ? (
              <div className="font-display text-[12px] tracking-[0.22em] mb-2" style={{ color: "var(--accent)", textShadow: "0 0 10px rgba(245,182,81,0.5)" }}>
                ★ new personal best ★
              </div>
            ) : (
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] mb-2" style={{ color: "var(--ink-dim)" }}>
                personal best · {personalBest.toLocaleString("en-US")}
              </div>
            )}

            <div className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--ink-dim)" }}>
              score
            </div>
            <div className="font-display mb-4" style={{ color: "var(--accent)", fontSize: 40, textShadow: "0 0 14px rgba(245,182,81,0.3)" }}>
              {result.score.toLocaleString("en-US")}
            </div>

            {result.stats.length > 0 && (
              <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: `repeat(${Math.min(result.stats.length, 4)}, 1fr)` }}>
                {result.stats.map((s) => (
                  <div key={s.label} className="flex flex-col items-center justify-center rounded-[2px] border py-2.5" style={{ borderColor: "var(--panel-border)", background: "rgba(255,255,255,0.02)" }}>
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-dim)" }}>
                      {s.label}
                    </span>
                    <span className="font-display" style={{ color: "var(--ink)", fontSize: 18 }}>
                      {typeof s.value === "number" ? s.value.toLocaleString("en-US") : s.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <SubmissionLine status={submission} />

            <div className="text-left my-4">
              <Leaderboard
                rows={board}
                loading={loadingBoard}
                columns={columns}
                highlightName={null}
                title="LEADERBOARD ─ TOP 10"
                emptyMessage={submission.state === "skipped" ? "playing locally · scores saved on this device" : "no scores yet · you could be first"}
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={onPlayAgain}
                className="font-display tracking-[0.24em] text-sm px-6 py-3 border w-full transition-all duration-150 hover:bg-[rgba(245,182,81,0.22)]"
                style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(245,182,81,0.1)" }}
              >
                ↻ PLAY AGAIN
              </button>
              <Link
                href="/"
                className="font-mono uppercase tracking-[0.22em] text-[11px] px-6 py-2 w-full text-center transition-colors hover:text-[var(--ink)]"
                style={{ color: "var(--ink-dim)" }}
              >
                ← back to arcade
              </Link>
            </div>
          </div>
        </PanelFrame>
      </motion.div>
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
      text = "saved locally";
      break;
    case "error":
      text =
        status.error === "rate_limited"
          ? "rate-limited · try again in a moment"
          : status.error === "implausible_score" || status.error === "implausible_time"
            ? "submission rejected by server (sanity check)"
            : `submission failed (${status.error})`;
      color = "var(--accent-hot)";
      break;
  }
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color }}>
      {text}
    </div>
  );
}
