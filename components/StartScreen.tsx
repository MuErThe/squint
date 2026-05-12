"use client";

import { AnimatePresence, motion } from "framer-motion";
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
  const [name, setName] = useState("");
  const [stored, setStored] = useState<StoredPlayer | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyReason, setBusyReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const lbOnline = leaderboardConfigured();
  const inputRef = useRef<HTMLInputElement>(null);

  // Load remembered player on mount.
  useEffect(() => {
    const p = loadStoredPlayer();
    if (p) {
      setStored(p);
      setName(p.name);
    }
  }, []);

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
          className="fixed inset-0 z-40 flex items-start md:items-center justify-center px-6 py-6 overflow-y-auto"
          style={{
            background: "rgba(14,10,20,0.78)",
            backdropFilter: "blur(4px)",
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
                ─── insert hand to continue ───
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

              {/* Secondary links — kept small so the START button stays the
                  primary call-to-action. */}
              <div className="flex items-center justify-center gap-4 mb-3 font-mono text-[10px] uppercase tracking-[0.22em]">
                <button
                  type="button"
                  onClick={() => setRulesOpen((o) => !o)}
                  className="transition-colors flex items-center gap-1"
                  style={{ color: rulesOpen ? "var(--accent)" : "var(--ink-dim)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--accent)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = rulesOpen
                      ? "var(--accent)"
                      : "var(--ink-dim)")
                  }
                >
                  <span>{rulesOpen ? "▾" : "▸"}</span>
                  {rulesOpen ? "hide rules" : "show rules"}
                </button>
                {lbOnline && (
                  <>
                    <span style={{ color: "var(--panel-border-strong)" }}>·</span>
                    <button
                      type="button"
                      onClick={() => setBoardOpen(true)}
                      className="transition-colors flex items-center gap-1.5"
                      style={{ color: "var(--ink-dim)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--accent)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--ink-dim)")
                      }
                    >
                      <span style={{ fontSize: 12 }}>🏆</span>
                      view leaderboard
                    </button>
                  </>
                )}
              </div>
              <AnimatePresence initial={false}>
                {rulesOpen && (
                  <motion.div
                    key="rules"
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <ControlHint
                        num="01"
                        title="STEER"
                        body="move your hand left or right to slide the falling tetromino"
                      />
                      <ControlHint
                        num="02"
                        title="PINCH TO ROTATE"
                        body="touch thumb to index — each pinch rotates the piece 90°"
                      />
                      <ControlHint
                        num="03"
                        title="DROP"
                        body="lower your hand into the bottom strip to fast-fall"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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

              <div className="flex flex-col gap-2">
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
                    : "▶ START WITH CAMERA"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => handleStart("keyboard")}
                  className="font-mono uppercase tracking-[0.22em] text-[11px] px-6 py-2.5 w-full transition-colors disabled:opacity-50 hover:text-[var(--ink)]"
                  style={{ color: "var(--ink-dim)" }}
                >
                  play with keyboard only →
                </button>
              </div>
            </div>

            <div
              className="px-8 md:px-10 py-3 font-mono text-[9px] uppercase tracking-[0.22em] border-t text-center"
              style={{
                borderColor: "var(--panel-border)",
                color: "var(--ink-dim)",
                background: "rgba(0,0,0,0.25)",
              }}
            >
              ← → move · ↑ rotate · ↓ soft · space hard
            </div>
          </motion.div>
          <LeaderboardModal
            show={boardOpen}
            onClose={() => setBoardOpen(false)}
            highlightName={stored?.name ?? null}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ControlHint({
  num,
  title,
  body,
}: {
  num: string;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-[2px] border px-2.5 py-2 flex flex-col gap-0.5"
      style={{
        borderColor: "var(--panel-border)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.18))",
      }}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="font-display text-[10px] tracking-[0.22em]"
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
        className="font-mono text-[9.5px] uppercase tracking-[0.06em] leading-snug"
        style={{ color: "var(--ink-dim)" }}
      >
        {body}
      </p>
    </div>
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
