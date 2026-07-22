"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { reserveName } from "@/lib/leaderboard/api";
import { LeaderboardModal } from "./LeaderboardModal";
import { leaderboardConfigured } from "@/lib/leaderboard/supabase";
import {
  loadStoredPlayer,
  saveStoredPlayer,
  type StoredPlayer,
} from "@/lib/leaderboard/local";
import {
  NAME_RULES,
  nameValidationMessage,
  validateName,
} from "@/lib/leaderboard/profanity";
import { generateRandomName } from "@/lib/leaderboard/random-name";
import { TETRIS_COLUMNS, TETRIS_GAME } from "@/lib/tetris/leaderboard";

interface StartResult {
  ok: boolean;
  error?: string;
}

interface StartScreenProps {
  show: boolean;
  /** Called only after the user is registered + camera mode chosen. */
  onStart: (
    mode: "camera" | "keyboard",
    player: StoredPlayer,
  ) => Promise<StartResult> | StartResult;
  onDismiss: () => void;
}

export function StartScreen({ show, onStart, onDismiss }: StartScreenProps) {
  // Remembered player loads via lazy initializers. Safe to read localStorage
  // here: the page gates rendering on `mounted`, so this component never
  // renders during SSR/hydration where the value could mismatch.
  const [stored, setStored] = useState<StoredPlayer | null>(loadStoredPlayer);
  const [name, setName] = useState(() => loadStoredPlayer()?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [busyReason, setBusyReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const lbOnline = leaderboardConfigured();
  const inputRef = useRef<HTMLInputElement>(null);

  const inlineMsg = (() => {
    if (!name) return null;
    const v = validateName(name);
    return v.ok ? null : nameValidationMessage(v);
  })();

  // Resolve the player to use. If we have a stored token for this exact
  // (case-insensitive) name, reuse it. Otherwise reserve a fresh one.
  const resolvePlayer = async (): Promise<StoredPlayer | null> => {
    let candidate = name.trim();
    if (!candidate) candidate = generateRandomName();
    setName(candidate);

    // Returning user: stored name matches what's typed.
    if (
      stored &&
      stored.name.toLowerCase() === candidate.toLowerCase()
    ) {
      return stored;
    }

    const v = validateName(candidate);
    if (!v.ok) {
      setError(nameValidationMessage(v));
      return null;
    }

    if (!lbOnline) {
      // No backend configured — name is local-only.
      const p = { name: candidate, token: "local" };
      saveStoredPlayer(p);
      return p;
    }

    setBusyReason("reserving name…");
    let attempt = candidate;
    for (let i = 0; i < 4; i++) {
      const res = await reserveName(attempt);
      if (res.ok) {
        const p = { name: attempt, token: res.token };
        saveStoredPlayer(p);
        setStored(p);
        return p;
      }
      if (res.error === "name_taken") {
        // Auto-suffix random retry only if the user explicitly left it blank
        // before our `generateRandomName` filled it.
        if (i < 3) {
          attempt = generateRandomName();
          setName(attempt);
          continue;
        }
        setError(`"${attempt}" is taken — try another or click GENERATE`);
        return null;
      }
      setError(
        res.error === "name_profanity"
          ? "please pick a different name"
          : res.error === "name_length"
            ? `name must be ${NAME_RULES.min}–${NAME_RULES.max} characters`
            : res.error === "name_charset"
              ? "letters, digits, underscore and dash only"
              : res.error === "offline"
                ? "leaderboard is offline — playing locally"
                : `couldn’t reserve name (${res.message ?? res.error})`,
      );
      return null;
    }
    return null;
  };

  const handleStart = async (mode: "camera" | "keyboard") => {
    setBusy(true);
    setError(null);
    try {
      const player = await resolvePlayer();
      if (!player) {
        return;
      }
      setBusyReason(
        mode === "camera" ? "starting camera…" : "loading game…",
      );
      const result = await onStart(mode, player);
      if (result.ok) {
        onDismiss();
      } else {
        setError(
          result.error
            ? `couldn’t access the camera: ${result.error}. keyboard is still an option.`
            : "couldn’t access the camera. keyboard is still an option.",
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`unexpected error: ${msg}`);
    } finally {
      setBusy(false);
      setBusyReason("");
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-40 flex items-start md:items-center justify-center px-6 py-6 overflow-y-auto overflow-x-hidden"
          style={{
            background: "rgba(14,10,20,0.9)",
            backdropFilter: "blur(24px)",
          }}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="panel-bg relative rounded-[2px] border max-w-[560px] w-full overflow-hidden my-auto"
            style={{
              borderColor: "var(--panel-border-strong)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
            }}
          >
            <CornerOrnament pos="tl" />
            <CornerOrnament pos="tr" />
            <CornerOrnament pos="bl" />
            <CornerOrnament pos="br" />

            <div className="px-8 md:px-10 py-7">
              <div
                className="font-display text-[10px] tracking-[0.32em] mb-3 text-center"
                style={{ color: "var(--accent)" }}
              >
                ─── byo hand ───
              </div>
              <h1
                className="font-display tracking-[0.18em] leading-[0.95] mb-5 text-center"
                style={{
                  color: "var(--ink)",
                  fontSize: "clamp(38px, 8vw, 56px)",
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

              {/* Name entry */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="font-display text-[10px] tracking-[0.22em]"
                    style={{ color: "var(--accent)" }}
                  >
                    PILOT TAG
                  </label>
                  <span
                    className="font-mono text-[9px] uppercase tracking-[0.18em]"
                    style={{
                      color: inlineMsg ? "var(--accent-hot)" : "var(--ink-dim)",
                    }}
                  >
                    {inlineMsg ?? `${name.length}/${NAME_RULES.max}`}
                  </span>
                </div>
                <div
                  className="flex gap-2 rounded-[2px] border p-1.5"
                  style={{
                    borderColor: "var(--panel-border-strong)",
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.05))",
                  }}
                >
                  <input
                    ref={inputRef}
                    value={name}
                    onChange={(e) => {
                      const v = e.target.value.slice(0, NAME_RULES.max);
                      setName(v);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !busy) handleStart("camera");
                    }}
                    placeholder="leave blank to auto-generate"
                    spellCheck={false}
                    autoComplete="off"
                    maxLength={NAME_RULES.max}
                    className="flex-1 bg-transparent outline-none font-display tracking-[0.18em] px-2"
                    style={{
                      color: "var(--ink)",
                      fontSize: 18,
                      caretColor: "var(--accent)",
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setName(generateRandomName());
                      setError(null);
                      inputRef.current?.focus();
                    }}
                    className="px-3 font-display text-[10px] tracking-[0.22em] rounded-[2px] border transition-colors hover:bg-[rgba(245,182,81,0.18)]"
                    style={{
                      borderColor: "var(--panel-border-strong)",
                      color: "var(--accent)",
                    }}
                  >
                    GENERATE
                  </button>
                </div>
                {stored && stored.name.toLowerCase() === name.toLowerCase() && (
                  <div
                    className="font-mono text-[9px] uppercase tracking-[0.18em] mt-1.5"
                    style={{ color: "var(--c-S)" }}
                  >
                    ✓ welcome back, {stored.name}
                  </div>
                )}
                {!lbOnline && (
                  <div
                    className="font-mono text-[9px] uppercase tracking-[0.18em] mt-1.5"
                    style={{ color: "var(--ink-dim)" }}
                  >
                    ⓘ leaderboard not configured · scores stay local
                  </div>
                )}
              </div>


              {error && (
                <div
                  className="font-mono text-[11px] mb-4 px-3 py-2 rounded-[2px] border"
                  style={{
                    borderColor: "rgba(255, 120, 73, 0.4)",
                    background: "rgba(255, 120, 73, 0.08)",
                    color: "var(--accent-hot)",
                  }}
                >
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2 mt-6">
                <button
                  disabled={busy}
                  onClick={() => handleStart("camera")}
                  className="font-display tracking-[0.24em] text-sm px-6 py-3.5 border w-full transition-all duration-150 disabled:opacity-50 hover:bg-[rgba(245,182,81,0.22)]"
                  style={{
                    borderColor: "var(--accent)",
                    color: "var(--accent)",
                    background: "rgba(245, 182, 81, 0.1)",
                    boxShadow: "0 0 24px rgba(245, 182, 81, 0.18)",
                  }}
                >
                  {busy
                    ? busyReason.toUpperCase() || "WORKING…"
                    : "▶ PLAY WITH HANDS"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => handleStart("keyboard")}
                  className="font-mono uppercase tracking-[0.22em] text-[11px] px-6 py-2.5 w-full transition-colors disabled:opacity-50 hover:text-[var(--ink)]"
                  style={{ color: "var(--ink-dim)" }}
                >
                  play with keyboard only →
                </button>
                <p
                  className="font-mono text-[9px] uppercase tracking-[0.18em] text-center mt-1"
                  style={{ color: "var(--ink-dim)", opacity: 0.8 }}
                >
                  🔒 video is processed on-device · never leaves your browser
                </p>
              </div>
            </div>

            {lbOnline && (
              <button
                type="button"
                onClick={() => setBoardOpen(true)}
                className="w-full px-8 md:px-10 py-3 font-mono text-[10px] uppercase tracking-[0.22em] border-t transition-colors flex items-center justify-center gap-2 hover:bg-[rgba(245,182,81,0.08)]"
                style={{
                  borderColor: "var(--panel-border)",
                  color: "var(--ink-dim)",
                  background: "rgba(0,0,0,0.25)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--accent)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--ink-dim)")
                }
              >
                <span style={{ fontSize: 13 }}>🏆</span>
                view leaderboard
              </button>
            )}
          </motion.div>
          <Link
            href="/"
            className="fixed top-4 left-4 z-[55] font-mono text-[10px] uppercase tracking-[0.24em] px-3 py-2 rounded-[2px] border transition-all duration-150 hover:-translate-y-px"
            style={{
              borderColor: "var(--panel-border-strong)",
              color: "var(--ink-dim)",
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(6px)",
            }}
          >
            ◂ arcade
          </Link>
          <AnimatePresence>
            {!rulesOpen && (
              <motion.button
                key="rules-trigger"
                type="button"
                onClick={() => setRulesOpen(true)}
                aria-label="show rules"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="fixed top-4 right-4 z-[55] font-display text-[11px] tracking-[0.24em] px-3.5 py-2 rounded-[2px] border transition-all duration-150 hover:brightness-110 hover:-translate-y-px flex items-center gap-1.5"
                style={{
                  borderColor: "var(--accent)",
                  color: "#1a1108",
                  background: "var(--accent)",
                  boxShadow:
                    "0 0 0 1px rgba(245,182,81,0.35), 0 0 24px rgba(245,182,81,0.55), 0 6px 18px rgba(0,0,0,0.45)",
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: 12, lineHeight: 1 }}>?</span>
                RULES
              </motion.button>
            )}
          </AnimatePresence>
          <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
          <LeaderboardModal
            show={boardOpen}
            onClose={() => setBoardOpen(false)}
            game={TETRIS_GAME}
            columns={TETRIS_COLUMNS}
            eyebrow="hall of pilots"
            countNoun="pilots"
            highlightName={stored?.name ?? null}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RulesPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Close on Escape for keyboard parity.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="rules-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.45)" }}
          />
          <motion.aside
            key="rules-panel"
            role="dialog"
            aria-label="rules"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="panel-bg fixed top-0 right-0 z-50 h-full w-full max-w-[380px] border-l overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              borderColor: "var(--panel-border-strong)",
              boxShadow: "-24px 0 60px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="sticky top-0 flex items-center justify-between px-6 py-4 border-b"
              style={{
                borderColor: "var(--panel-border)",
                background: "rgba(0,0,0,0.45)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div>
                <div
                  className="font-display text-[9px] tracking-[0.32em] mb-0.5"
                  style={{ color: "var(--accent)" }}
                >
                  ─── manual ───
                </div>
                <h2
                  className="font-display tracking-[0.22em] text-lg"
                  style={{ color: "var(--ink)" }}
                >
                  RULES
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="close rules"
                className="w-8 h-8 flex items-center justify-center rounded-[2px] border transition-colors hover:bg-[rgba(245,182,81,0.18)]"
                style={{
                  borderColor: "var(--panel-border-strong)",
                  color: "var(--accent)",
                }}
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              <div
                className="flex items-center gap-3 font-display text-[10px] tracking-[0.32em]"
                style={{ color: "var(--accent)" }}
              >
                <span
                  className="flex-1 h-px"
                  style={{ background: "var(--panel-border-strong)" }}
                />
                hand gestures
                <span
                  className="flex-1 h-px"
                  style={{ background: "var(--panel-border-strong)" }}
                />
              </div>

              <RuleRow
                num="01"
                title="STEER"
                body="move your hand left or right to slide the falling tetromino across the board"
                illo={<HandIllustration type="steer" />}
              />
              <RuleRow
                num="02"
                title="PINCH TO ROTATE"
                body="touch thumb to index finger — each pinch rotates the piece 90 degrees clockwise"
                illo={<HandIllustration type="pinch" />}
              />
              <RuleRow
                num="03"
                title="DROP"
                body="lower your hand into the bottom strip of the camera frame to fast-fall the piece"
                illo={<HandIllustration type="drop" />}
              />

              <div
                className="flex items-center gap-3 mt-2 font-display text-[10px] tracking-[0.32em]"
                style={{ color: "var(--accent)" }}
              >
                <span
                  className="flex-1 h-px"
                  style={{ background: "var(--panel-border-strong)" }}
                />
                keyboard fallback
                <span
                  className="flex-1 h-px"
                  style={{ background: "var(--panel-border-strong)" }}
                />
              </div>

              <RuleRow
                num="04"
                title="MOVE"
                body="press the left or right arrow key to slide the piece across the board"
                illo={<KeyIllustration type="arrows-lr" />}
              />
              <RuleRow
                num="05"
                title="ROTATE"
                body="press the up arrow key — each tap rotates the piece 90 degrees clockwise"
                illo={<KeyIllustration type="arrow-up" />}
              />
              <RuleRow
                num="06"
                title="SOFT DROP"
                body="hold the down arrow key to accelerate the piece downward"
                illo={<KeyIllustration type="arrow-down" />}
              />
              <RuleRow
                num="07"
                title="HARD DROP"
                body="hit the space bar to slam the piece straight to the bottom"
                illo={<KeyIllustration type="spacebar" />}
              />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function RuleRow({
  num,
  title,
  body,
  illo,
}: {
  num: string;
  title: string;
  body: string;
  illo: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[2px] border px-3 py-3 flex gap-3 items-start"
      style={{
        borderColor: "var(--panel-border)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.22))",
      }}
    >
      <div
        className="shrink-0 w-[88px] h-[88px] rounded-[2px] border flex items-center justify-center"
        style={{
          borderColor: "var(--panel-border)",
          background: "rgba(0,0,0,0.35)",
          color: "var(--accent)",
        }}
      >
        {illo}
      </div>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <span
            className="font-display text-[11px] tracking-[0.22em]"
            style={{ color: "var(--accent)" }}
          >
            {title}
          </span>
          <span
            className="font-display text-[9px]"
            style={{ color: "var(--ink-dim)" }}
          >
            {num}
          </span>
        </div>
        <p
          className="font-mono text-[10px] uppercase tracking-[0.06em] leading-snug"
          style={{ color: "var(--ink-dim)" }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}

function KeyIllustration({
  type,
}: {
  type: "arrows-lr" | "arrow-up" | "arrow-down" | "spacebar";
}) {
  const stroke = "currentColor";
  const sw = 1.4;
  if (type === "arrows-lr") {
    return (
      <svg
        viewBox="0 0 80 60"
        width="76"
        height="56"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* left key */}
        <rect x="4" y="16" width="30" height="28" rx="4" />
        <path d="M26 30 L14 30 M19 25 L14 30 L19 35" strokeWidth={1.6} />
        {/* right key */}
        <rect x="46" y="16" width="30" height="28" rx="4" />
        <path d="M54 30 L66 30 M61 25 L66 30 L61 35" strokeWidth={1.6} />
      </svg>
    );
  }
  if (type === "arrow-up") {
    return (
      <svg
        viewBox="0 0 80 70"
        width="58"
        height="58"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* curved rotation hint */}
        <path
          d="M16 14 Q40 6 64 14"
          strokeDasharray="2 3"
          opacity="0.55"
        />
        <path d="M60 9 L64 14 L59 17" opacity="0.55" />
        {/* key */}
        <rect x="22" y="22" width="36" height="36" rx="4" />
        <path d="M40 48 L40 32 M32 40 L40 32 L48 40" strokeWidth={1.6} />
      </svg>
    );
  }
  if (type === "arrow-down") {
    return (
      <svg
        viewBox="0 0 80 80"
        width="58"
        height="64"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* key */}
        <rect x="22" y="10" width="36" height="36" rx="4" />
        <path d="M40 20 L40 36 M32 28 L40 36 L48 28" strokeWidth={1.6} />
        {/* motion trails */}
        <path d="M28 56 L52 56" strokeDasharray="2 3" opacity="0.55" />
        <path d="M32 64 L48 64" strokeDasharray="2 3" opacity="0.4" />
        <path d="M36 72 L44 72" strokeDasharray="2 3" opacity="0.28" />
      </svg>
    );
  }
  // spacebar
  return (
    <svg
      viewBox="0 0 90 70"
      width="78"
      height="60"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* wide key */}
      <rect x="6" y="10" width="78" height="20" rx="4" />
      <text
        x="45"
        y="24"
        textAnchor="middle"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        fontSize="8"
        letterSpacing="3"
        fill={stroke}
        stroke="none"
      >
        SPACE
      </text>
      {/* slam trail */}
      <path d="M18 40 L72 40" strokeDasharray="2 3" opacity="0.55" />
      <path d="M28 50 L62 50" strokeDasharray="2 3" opacity="0.38" />
      <path d="M45 56 L45 64 M41 60 L45 64 L49 60" strokeWidth={1.6} />
    </svg>
  );
}

function HandIllustration({ type }: { type: "steer" | "pinch" | "drop" }) {
  const stroke = "currentColor";
  const sw = 1.3;
  if (type === "steer") {
    return (
      <svg
        viewBox="0 0 110 70"
        width="86"
        height="54"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* left arrow */}
        <path d="M24 36 L6 36 M14 30 L6 36 L14 42" />
        {/* hand pointing up */}
        <g transform="translate(38 4)">
          {/* fingers — varied heights (index, middle, ring, pinky) */}
          <path d="M4 26 L4 14 Q4 10 7 10 Q10 10 10 14 L10 26" strokeWidth={2} />
          <path d="M11 26 L11 6 Q11 2 14 2 Q17 2 17 6 L17 26" strokeWidth={2} />
          <path d="M18 26 L18 8 Q18 4 21 4 Q24 4 24 8 L24 26" strokeWidth={2} />
          <path d="M25 26 L25 16 Q25 12 27 12 Q29 12 29 16 L29 26" strokeWidth={2} />
          {/* palm (rounded U) */}
          <path d="M2 26 Q2 56 17 56 Q32 56 32 26" />
          {/* thumb curving out from lower-left */}
          <path d="M2 34 Q-8 32 -10 42" strokeWidth={2} />
          {/* knuckle crease for warmth */}
          <path d="M6 40 Q16 44 28 40" opacity="0.45" />
        </g>
        {/* right arrow */}
        <path d="M86 36 L104 36 M96 30 L104 36 L96 42" />
      </svg>
    );
  }
  if (type === "pinch") {
    return (
      <svg
        viewBox="0 0 80 80"
        width="64"
        height="64"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* palm */}
        <path d="M22 50 Q22 38 30 36 L30 30 Q30 26 34 26 Q38 26 38 30 L38 34" />
        <path d="M22 50 Q22 62 32 66 L50 66 Q58 66 58 58 L58 44" />
        {/* curled fingers */}
        <path d="M40 38 Q44 36 46 40 L46 44" />
        <path d="M48 40 Q52 38 54 42 L54 46" />
        <path d="M56 42 Q60 40 60 44 L60 48" />
        {/* thumb meeting index — pinch */}
        <path d="M30 30 Q26 22 30 16" />
        <path d="M38 30 Q42 22 36 16" />
        {/* contact point with spark */}
        <circle cx="33" cy="14" r="2.2" />
        <path d="M33 6 L33 9" opacity="0.7" />
        <path d="M26 10 L28.5 12" opacity="0.7" />
        <path d="M40 10 L37.5 12" opacity="0.7" />
      </svg>
    );
  }
  // drop — hand with fingers pointing down toward a dashed target strip
  return (
    <svg
      viewBox="0 0 80 96"
      width="62"
      height="76"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform="translate(24 2)">
        {/* palm (rounded dome on top) */}
        <path d="M2 18 Q2 -10 17 -10 Q32 -10 32 18" />
        {/* fingers hanging down — varied lengths */}
        <path d="M4 18 L4 30 Q4 34 7 34 Q10 34 10 30 L10 18" strokeWidth={2} />
        <path d="M11 18 L11 38 Q11 42 14 42 Q17 42 17 38 L17 18" strokeWidth={2} />
        <path d="M18 18 L18 36 Q18 40 21 40 Q24 40 24 36 L24 18" strokeWidth={2} />
        <path d="M25 18 L25 28 Q25 32 27 32 Q29 32 29 28 L29 18" strokeWidth={2} />
        {/* thumb curving out from upper-right */}
        <path d="M32 10 Q42 12 44 2" strokeWidth={2} />
        {/* knuckle crease */}
        <path d="M6 4 Q16 0 28 4" opacity="0.45" />
      </g>
      {/* downward motion arrow */}
      <path d="M40 58 L40 82 M32 74 L40 82 L48 74" />
      {/* target strip */}
      <path d="M8 92 L72 92" strokeDasharray="2 3" opacity="0.6" />
    </svg>
  );
}

function CornerOrnament({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const map: Record<typeof pos, string> = {
    tl: "top-2 left-2",
    tr: "top-2 right-2",
    bl: "bottom-2 left-2",
    br: "bottom-2 right-2",
  } as const;
  const isLeft = pos.endsWith("l");
  const isTop = pos.startsWith("t");
  return (
    <div className={`pointer-events-none absolute w-4 h-4 ${map[pos]}`}>
      <div
        className="absolute w-4 h-px"
        style={{
          background: "var(--accent)",
          top: isTop ? 0 : "auto",
          bottom: isTop ? "auto" : 0,
          left: isLeft ? 0 : "auto",
          right: isLeft ? "auto" : 0,
        }}
      />
      <div
        className="absolute w-px h-4"
        style={{
          background: "var(--accent)",
          top: isTop ? 0 : "auto",
          bottom: isTop ? "auto" : 0,
          left: isLeft ? 0 : "auto",
          right: isLeft ? "auto" : 0,
        }}
      />
    </div>
  );
}
