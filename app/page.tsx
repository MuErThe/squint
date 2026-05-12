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
import { playSfx, unlockAudio } from "@/lib/audio/sfx";

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
  const [vpBlocked, setVpBlocked] = useState(false);
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
  const [isPaused, setIsPaused] = useState(false);

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

  // Lock the game to landscape laptops/tablets. Anything narrower than 900px
  // or with portrait orientation gets the MobileGate instead.
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setVpBlocked(w < 900 || h > w);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
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

    // Sad descending melody for a natural top-out only — a manual quit
    // already had its own UX, no need to pile on a defeat sound.
    if (!endedManually) playSfx("gameOver");

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
  }, [isOver, runId, player, score, lines, level, endedManually, refreshLeaderboard]);

  const handleStart = useCallback(
    async (
      mode: "camera" | "keyboard",
      registered: StoredPlayer,
    ): Promise<{ ok: boolean; error?: string }> => {
      // Prime the audio pool under the start-click user gesture so engine
      // sfx (rotate / step / line clear) can fire without browser blocks.
      unlockAudio();
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
    playSfx("start");
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
    setIsPaused(false);
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
    playSfx("quit");
    g.isOver = true;
    setEndedManually(true);
    setIsPaused(false);
    setIsOver(true);
  }, []);

  const handlePauseToggle = useCallback(() => {
    setIsPaused((p) => !p);
    // Read `isPaused` from the closure snapshot — the callback is rebuilt on
    // every change so this reflects the state *before* the toggle.
    playSfx(isPaused ? "resume" : "pause");
  }, [isPaused]);

  /** Return to the start screen — also clears the run. */
  const handleBackToMenu = useCallback(() => {
    handleRestart();
    setStarted(false);
  }, [handleRestart]);

  // Q quits, P toggles pause — only while a run is in progress.
  // Must be declared BEFORE the viewport early-returns so the hook count
  // stays stable across renders (rules of hooks).
  useEffect(() => {
    if (!started || isOver) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "q") {
        e.preventDefault();
        handleQuit();
      } else if (k === "p" && !isPaused) {
        e.preventDefault();
        handlePauseToggle();
      } else if (k === "r" && isPaused) {
        e.preventDefault();
        handlePauseToggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, isOver, isPaused, handleQuit, handlePauseToggle]);

  const sessionRunning = started && !isOver && !isPaused;

  // Gate the entire tree on viewport measurement. The static export pre-renders
  // a desktop layout; on mobile / portrait we have to swap to MobileGate before
  // any of the heavy game components attempt to mount, or a hydration error in
  // those components will surface as a generic "page couldn't load" screen.
  if (!mounted) {
    return (
      <div
        className="fixed inset-0"
        style={{ background: "#000" }}
        aria-hidden
      />
    );
  }
  if (vpBlocked) {
    return <MobileGate />;
  }

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
            gesture mode
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePauseToggle}
                title={isPaused ? "Resume the run (R)" : "Pause the run (P)"}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-[2px] border-2 font-display text-[11px] tracking-[0.24em] transition-all duration-150"
                style={{
                  borderColor: "var(--accent)",
                  color: "#1a1108",
                  background: isPaused
                    ? "linear-gradient(180deg, #ffd28a, var(--accent))"
                    : "linear-gradient(180deg, var(--accent), #d99339)",
                  boxShadow:
                    "0 0 18px rgba(245, 182, 81, 0.5), inset 0 -2px 0 rgba(0,0,0,0.25)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 0 28px rgba(245, 182, 81, 0.8), inset 0 -2px 0 rgba(0,0,0,0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 0 18px rgba(245, 182, 81, 0.5), inset 0 -2px 0 rgba(0,0,0,0.25)";
                }}
              >
                <KeyBadge letter={isPaused ? "R" : "P"} tone="dark" />
                {isPaused ? "RESUME" : "PAUSE"}
              </button>
              <button
                type="button"
                onClick={handleQuit}
                title="End the current run (Q)"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-[2px] border-2 font-display text-[11px] tracking-[0.24em] transition-all duration-150"
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
                <KeyBadge letter="Q" tone="light" />
                QUIT
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Body grid */}
      <div className="flex-1 grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-[1fr_minmax(340px,420px)] grid-rows-[auto] md:grid-rows-1 min-h-0">
        <PanelFrame
          label="PLAYFIELD"
          hint="12 × 20"
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
                paused={!started || isPaused}
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
            {isPaused && started && !isOver && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(14,10,20,0.6)", backdropFilter: "blur(2px)" }}
              >
                <div className="text-center">
                  <div
                    className="font-display tracking-[0.34em] text-3xl mb-2"
                    style={{
                      color: "var(--accent)",
                      textShadow: "0 0 24px rgba(245,182,81,0.6)",
                    }}
                  >
                    PAUSED
                  </div>
                  <div
                    className="font-mono text-[10px] uppercase tracking-[0.22em]"
                    style={{ color: "var(--ink-dim)" }}
                  >
                    press <KeyBadge letter="R" tone="light" /> to resume
                  </div>
                </div>
              </div>
            )}
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

        <div className="grid gap-3 md:gap-4 grid-rows-2 min-h-0">
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

function MobileGate() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "#000" }}
    >
      <div
        className="font-display text-[10px] tracking-[0.32em] mb-3"
        style={{ color: "var(--accent)" }}
      >
        ─── wrong stage ───
      </div>
      <h1
        className="font-display tracking-[0.18em] leading-[0.95] mb-3"
        style={{
          color: "var(--ink)",
          fontSize: "clamp(34px, 9vw, 56px)",
        }}
      >
        HAND
        <br />
        <span
          style={{
            color: "var(--accent)",
            textShadow: "0 0 20px rgba(245,182,81,0.35)",
          }}
        >
          TETRIS
        </span>
      </h1>

      <RotateDeviceAnimation />

      <h2
        className="font-display tracking-[0.22em] text-base md:text-lg mt-5 mb-2"
        style={{ color: "var(--accent)" }}
      >
        GO WIDE, PILOT
      </h2>
      <p
        className="font-mono text-[10px] uppercase tracking-[0.22em] leading-relaxed max-w-[300px]"
        style={{ color: "var(--ink-dim)" }}
      >
        hand tetris needs elbow room.
        <br />
        flip your tablet to landscape
        <br />
        — or hop onto a laptop.
      </p>

      <div
        className="font-mono text-[9px] uppercase tracking-[0.22em] mt-6"
        style={{ color: "var(--panel-border-strong)" }}
      >
        min ░ 900 px wide · landscape only
      </div>
    </div>
  );
}

function RotateDeviceAnimation() {
  return (
    <div className="relative w-36 h-36 my-2 flex items-center justify-center">
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Curved rotation arc — hints the motion */}
        <path
          d="M 22 60 A 38 38 0 0 1 98 60"
          strokeDasharray="3 4"
          opacity="0.5"
        />
        <path d="M 92 53 L 98 60 L 92 67" opacity="0.5" />

        {/* Device (rotates via CSS keyframe) */}
        <g
          className="tetris-rotate-device"
          style={{ transformOrigin: "60px 60px" }}
        >
          <rect x="45" y="32" width="30" height="56" rx="4" />
          <line x1="56" y1="83" x2="64" y2="83" strokeWidth="1.2" />
          {/* tiny tetris piece on screen for flavor */}
          <rect x="51" y="44" width="6" height="6" opacity="0.6" />
          <rect x="57" y="44" width="6" height="6" opacity="0.6" />
          <rect x="63" y="44" width="6" height="6" opacity="0.6" />
          <rect x="57" y="50" width="6" height="6" opacity="0.6" />
        </g>
      </svg>
      <style>{`
        .tetris-rotate-device {
          animation: tetris-rotate-device 3.4s ease-in-out infinite;
        }
        @keyframes tetris-rotate-device {
          0%, 22% { transform: rotate(0deg); }
          38%, 72% { transform: rotate(-90deg); }
          88%, 100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}

function KeyBadge({ letter, tone }: { letter: string; tone: "light" | "dark" }) {
  const isDark = tone === "dark";
  return (
    <span
      className="inline-flex items-center justify-center font-mono leading-none"
      style={{
        width: 16,
        height: 16,
        fontSize: 9,
        borderRadius: 2,
        border: `1px solid ${isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)"}`,
        background: isDark ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.18)",
        color: isDark ? "#1a1108" : "#fff",
      }}
    >
      {letter}
    </span>
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
