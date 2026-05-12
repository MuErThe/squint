"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PanelFrame } from "@/components/PanelFrame";
import { ScorePanel } from "@/components/ScorePanel";
import { StartScreen } from "@/components/StartScreen";
import {
  GameOverOverlay,
  type SubmissionStatus,
} from "@/components/GameOverOverlay";
import {
  VisionFeed,
  type CameraStatus,
  type VisionFeedHandle,
} from "@/components/VisionFeed";
import { StatusIndicators } from "@/components/StatusIndicators";
import { PinchMeter } from "@/components/PinchMeter";
import { SessionTimer } from "@/components/SessionTimer";
import { KeyboardHints } from "@/components/KeyboardHints";
import { createInitialState } from "@/lib/tetris/engine";
import type { GameState, PieceType } from "@/lib/tetris/types";
import { initialGestureState } from "@/lib/hand/types";
import type { UiSnapshot } from "@/lib/hooks/useGameController";
import {
  fetchTop10,
  submitScore,
  type LeaderboardRow,
} from "@/lib/leaderboard/api";
import {
  loadBest,
  loadStoredPlayer,
  maybeUpdateBest,
  type StoredBest,
  type StoredPlayer,
} from "@/lib/leaderboard/local";
import { leaderboardConfigured } from "@/lib/leaderboard/supabase";

const Playfield3D = dynamic(
  () => import("@/components/Playfield3D").then((m) => m.Playfield3D),
  { ssr: false },
);

export default function Home() {
  const gameRef = useRef<GameState | null>(null);
  const gestureRef = useRef(initialGestureState());
  const movementFreezeUntilRef = useRef<number>(0);
  const visionRef = useRef<VisionFeedHandle>(null);

  const [mounted, setMounted] = useState(false);
  const [started, setStarted] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("init");
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [queue, setQueue] = useState<PieceType[]>([]);
  const [isOver, setIsOver] = useState(false);
  /** True when the run ended via the QUIT button rather than a top-out. */
  const [endedManually, setEndedManually] = useState(false);
  const [runId, setRunId] = useState(0);

  // Leaderboard / player
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [personalBest, setPersonalBest] = useState<StoredBest | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [submission, setSubmission] = useState<SubmissionStatus>({
    state: "idle",
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Play-time tracking — captured at the moment the run starts and frozen on
  // the first game-over event. Server uses it for plausibility.
  const runStartRef = useRef<number>(0);
  const runDurationRef = useRef<number>(0);
  // Latch so we only submit / refresh leaderboard once per run.
  const submittedRunRef = useRef<number>(-1);

  useEffect(() => {
    gameRef.current = createInitialState();
    setQueue(gameRef.current.queue.slice(0, 3));
    setPersonalBest(loadBest());
    setPlayer(loadStoredPlayer());
    setMounted(true);
  }, []);

  const handleUiUpdate = useCallback((snap: UiSnapshot) => {
    setScore(snap.score);
    setLines(snap.lines);
    setLevel(snap.level);
    setQueue(snap.queue);
    setIsOver(snap.isOver);
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    if (!leaderboardConfigured()) return;
    setLoadingLeaderboard(true);
    try {
      const rows = await fetchTop10();
      setLeaderboard(rows);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  // Pre-fetch the board on mount so it's ready by Game Over.
  useEffect(() => {
    if (mounted) void refreshLeaderboard();
  }, [mounted, refreshLeaderboard]);

  // Submit-on-game-over effect. Runs exactly once per run.
  useEffect(() => {
    if (!isOver) return;
    if (submittedRunRef.current === runId) return;
    submittedRunRef.current = runId;

    // Freeze the run duration on first game-over.
    runDurationRef.current = Math.max(
      0,
      performance.now() - runStartRef.current,
    );

    const finalScore = score;
    const finalLines = lines;
    const finalLevel = level;

    // Personal best
    const improved = maybeUpdateBest({
      score: finalScore,
      lines: finalLines,
      level: finalLevel,
      at: Date.now(),
    });
    if (improved) {
      setPersonalBest(improved);
      setNewBest(true);
    } else {
      setNewBest(false);
    }

    // Server submission
    if (!player || !leaderboardConfigured()) {
      setSubmission({ state: "skipped" });
      return;
    }
    if (finalLines === 0 && finalScore === 0) {
      // Don't pollute the board with empty runs.
      setSubmission({ state: "skipped" });
      return;
    }
    setSubmission({ state: "submitting" });
    (async () => {
      const res = await submitScore({
        name: player.name,
        token: player.token,
        score: finalScore,
        lines: finalLines,
        level: finalLevel,
        playTimeMs: runDurationRef.current,
      });
      if (res.ok) {
        setSubmission({ state: "ok" });
        await refreshLeaderboard();
      } else {
        setSubmission({
          state: "error",
          error: res.error,
          message: res.message,
        });
      }
    })();
  }, [isOver, runId, player, score, lines, level, refreshLeaderboard]);

  const handleStart = useCallback(
    async (
      mode: "camera" | "keyboard",
      registered: StoredPlayer,
    ): Promise<{ ok: boolean; error?: string }> => {
      setPlayer(registered);
      if (mode === "keyboard") return { ok: true };
      const result = await visionRef.current?.boot();
      return result ?? { ok: false, error: "vision feed not mounted" };
    },
    [],
  );

  const handleStartDismiss = useCallback(() => {
    runStartRef.current = performance.now();
    runDurationRef.current = 0;
    setStarted(true);
  }, []);

  const handleRestart = useCallback(() => {
    const fresh = createInitialState();
    gameRef.current = fresh;
    setScore(0);
    setLines(0);
    setLevel(1);
    setQueue(fresh.queue.slice(0, 3));
    setIsOver(false);
    setEndedManually(false);
    setSubmission({ state: "idle" });
    setNewBest(false);
    runStartRef.current = performance.now();
    runDurationRef.current = 0;
    setRunId((n) => n + 1);
  }, []);

  /** End the current run on demand. Falls through to the normal game-over flow. */
  const handleQuit = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.isOver) return;
    g.isOver = true;
    setEndedManually(true);
    setIsOver(true);
  }, []);

  /** Return to the start screen — also clears the run. */
  const handleBackToMenu = useCallback(() => {
    handleRestart();
    setStarted(false);
  }, [handleRestart]);

  const sessionRunning = started && !isOver;

  return (
    <div
      className="relative flex-1 flex flex-col w-full h-screen overflow-hidden gap-3"
      style={{ padding: "16px 18px" }}
    >
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-baseline gap-3">
          <h1
            className="font-display text-xl md:text-2xl tracking-[0.22em] leading-none"
            style={{ color: "var(--ink)" }}
          >
            HAND <span style={{ color: "var(--accent)" }}>TETRIS</span>
          </h1>
          <span
            className="font-mono text-[9px] uppercase tracking-[0.22em]"
            style={{ color: "var(--ink-dim)" }}
          >
            v1 · gesture mode
          </span>
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          {player && (
            <div
              className="flex items-center gap-2 px-2.5 py-1 rounded-[2px]"
              style={{ border: "1px solid var(--panel-border)" }}
            >
              <span
                className="font-mono text-[9px] uppercase tracking-[0.22em]"
                style={{ color: "var(--ink-dim)" }}
              >
                pilot
              </span>
              <span
                className="font-display text-[12px]"
                style={{ color: "var(--accent)" }}
              >
                {player.name}
              </span>
            </div>
          )}
          <CamBadge status={cameraStatus} />
          <SessionTimer running={sessionRunning} resetKey={runId} />
          {started && !isOver && (
            <button
              type="button"
              onClick={handleQuit}
              title="End the current run"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[2px] border-2 font-display text-[11px] tracking-[0.24em] transition-all duration-150"
              style={{
                borderColor: "var(--accent-hot)",
                color: "#fff",
                background:
                  "linear-gradient(180deg, var(--accent-hot), #d8451c)",
                boxShadow:
                  "0 0 18px rgba(255, 120, 73, 0.55), inset 0 -2px 0 rgba(0,0,0,0.25)",
                textShadow: "0 1px 0 rgba(0,0,0,0.35)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(180deg, #ff8a5a, var(--accent-hot))";
                e.currentTarget.style.boxShadow =
                  "0 0 28px rgba(255, 120, 73, 0.85), inset 0 -2px 0 rgba(0,0,0,0.25)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(180deg, var(--accent-hot), #d8451c)";
                e.currentTarget.style.boxShadow =
                  "0 0 18px rgba(255, 120, 73, 0.55), inset 0 -2px 0 rgba(0,0,0,0.25)";
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>✕</span> QUIT
            </button>
          )}
        </div>
      </header>

      {/* Body grid */}
      <div className="flex-1 grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-[1fr_minmax(340px,420px)] grid-rows-[auto] md:grid-rows-1 min-h-0">
        <PanelFrame
          label="PLAYFIELD"
          hint="10 × 20"
          className="flex flex-col min-h-0"
          contentClassName="flex-1 flex min-h-0"
        >
          <div className="w-full flex-1 min-h-0 rounded-sm overflow-hidden relative">
            {mounted && (
              <Playfield3D
                key={runId}
                gameRef={gameRef as React.MutableRefObject<GameState>}
                gestureRef={gestureRef}
                movementFreezeUntilRef={movementFreezeUntilRef}
                onUiUpdate={handleUiUpdate}
                paused={!started}
              />
            )}
            <div
              className="pointer-events-none absolute top-2 left-2 px-2 py-1 rounded-[2px]"
              style={{
                background: "rgba(14,10,20,0.55)",
                border: "1px solid var(--panel-border)",
              }}
            >
              <span
                className="font-mono text-[9px] uppercase tracking-[0.22em]"
                style={{ color: "var(--ink-dim)" }}
              >
                level
              </span>{" "}
              <span
                className="font-display text-[11px]"
                style={{ color: "var(--accent)" }}
              >
                {level}
              </span>
            </div>
            <div
              className="pointer-events-none absolute top-2 right-2 px-2 py-1 rounded-[2px]"
              style={{
                background: "rgba(14,10,20,0.55)",
                border: "1px solid var(--panel-border)",
              }}
            >
              <span
                className="font-mono text-[9px] uppercase tracking-[0.22em]"
                style={{ color: "var(--ink-dim)" }}
              >
                score
              </span>{" "}
              <span
                className="font-display text-[11px]"
                style={{ color: "var(--ink)" }}
              >
                {score.toLocaleString("en-US")}
              </span>
            </div>
          </div>
        </PanelFrame>

        <div className="grid gap-3 md:gap-4 grid-rows-[auto_1fr] min-h-0">
          <ScorePanel
            score={score}
            lines={lines}
            level={level}
            queue={queue}
            personalBest={personalBest}
          />
          <PanelFrame
            label="VISION"
            hint="hand tracker"
            className="flex flex-col min-h-0"
            contentClassName="flex-1 flex flex-col gap-2 min-h-0"
            rightSlot={<StatusIndicators gestureRef={gestureRef} />}
          >
            <div className="w-full flex-1 min-h-0 relative">
              <VisionFeed
                ref={visionRef}
                gestureRef={gestureRef}
                movementFreezeUntilRef={movementFreezeUntilRef}
                onStatusChange={setCameraStatus}
              />
            </div>
            <PinchMeter gestureRef={gestureRef} />
          </PanelFrame>
        </div>
      </div>

      {/* Footer */}
      <footer className="shrink-0 flex items-center justify-between gap-3 flex-wrap">
        <KeyboardHints />
        <span
          className="font-mono text-[9px] uppercase tracking-[0.22em]"
          style={{ color: "var(--ink-dim)" }}
        >
          ─── pinch · steer · drop ───
        </span>
      </footer>

      <StartScreen
        show={!started}
        onStart={handleStart}
        onDismiss={handleStartDismiss}
      />

      <GameOverOverlay
        show={isOver}
        score={score}
        lines={lines}
        level={level}
        playerName={player?.name ?? null}
        newBest={newBest}
        personalBest={personalBest}
        submission={submission}
        leaderboard={leaderboard}
        loadingLeaderboard={loadingLeaderboard}
        onRestart={handleRestart}
        onBackToMenu={handleBackToMenu}
        endedManually={endedManually}
      />
    </div>
  );
}

function CamBadge({ status }: { status: CameraStatus }) {
  const map: Record<CameraStatus, { label: string; dot: string }> = {
    init: { label: "idle", dot: "var(--ink-dim)" },
    requesting: { label: "starting…", dot: "var(--accent)" },
    ready: { label: "live", dot: "var(--c-S)" },
    failed: { label: "offline", dot: "var(--accent-hot)" },
  };
  const cur = map[status];
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1 rounded-[2px]"
      style={{ border: "1px solid var(--panel-border)" }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: cur.dot, boxShadow: `0 0 6px ${cur.dot}` }}
      />
      <span
        className="font-mono text-[9px] uppercase tracking-[0.22em]"
        style={{ color: "var(--ink-dim)" }}
      >
        cam · {cur.label}
      </span>
    </div>
  );
}
