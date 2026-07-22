"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { VisionFeed, type VisionFeedHandle } from "@/components/VisionFeed";
import { initialGestureState } from "@/lib/hand/types";
import { Sparkline } from "@/components/arcade/Sparkline";
import { Vignette } from "@/components/arcade/Vignette";
import { FocalPlane } from "@/components/focal/FocalPlane";
import { bestScore, recordSession, scoreTrend, loadSessions } from "@/lib/learning/progress";
import { playSfx, unlockAudio } from "@/lib/audio/sfx";
import {
  CATEGORIES,
  CONSTRAINTS,
  DURATION_MS,
  GRID_COLS,
  GRID_ROWS,
  REFLECTION_PROMPTS,
  THIRTY_GAME,
  TOTAL_CIRCLES,
  type Category,
} from "@/lib/thirtycircles/config";

type Phase = "start" | "drawing" | "reflect";
type Mode = "mouse" | "camera";
type Point = { x: number; y: number };

export default function ThirtyCirclesPage() {
  const [mounted, setMounted] = useState(false);
  const [vpBlocked, setVpBlocked] = useState(false);
  const [phase, setPhase] = useState<Phase>("start");
  const [mode, setMode] = useState<Mode>("mouse");
  const [runKey, setRunKey] = useState(0);
  const [constraint, setConstraint] = useState<string | null>(null);

  const [remaining, setRemaining] = useState(DURATION_MS);
  const [attempted, setAttempted] = useState(0);
  const [gallery, setGallery] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");
  const [picked, setPicked] = useState<Category[]>([]);

  const gestureRef = useRef(initialGestureState());
  const movementFreezeUntilRef = useRef(0);
  const visionRef = useRef<VisionFeedHandle>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const lastPointRef = useRef<Point | null>(null);
  const penDownRef = useRef(false);
  const touchedRef = useRef<Set<number>>(new Set());
  const emaRef = useRef<Point>({ x: 0.5, y: 0.5 });
  const endAtRef = useRef(0);

  useEffect(() => {
    setMounted(true);
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

  const trend = mounted ? scoreTrend(THIRTY_GAME) : [];
  const best = mounted ? bestScore(THIRTY_GAME) : 0;

  // --- Drawing primitives -------------------------------------------------

  const drawGrid = useCallback(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const cellW = w / GRID_COLS;
    const cellH = h / GRID_ROWS;
    const r = Math.min(cellW, cellH) * 0.38;
    ctx.strokeStyle = "rgba(245,182,81,0.22)";
    ctx.lineWidth = 1.25;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        ctx.beginPath();
        ctx.arc((col + 0.5) * cellW, (row + 0.5) * cellH, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, []);

  const sizeCanvas = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(rect.width * dpr);
    cv.height = Math.round(rect.height * dpr);
    const ctx = cv.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    sizeRef.current = { w: rect.width, h: rect.height };
    drawGrid();
  }, [drawGrid]);

  const touchCell = useCallback((p: Point) => {
    const { w, h } = sizeRef.current;
    const col = Math.floor((p.x / w) * GRID_COLS);
    const row = Math.floor((p.y / h) * GRID_ROWS);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    const idx = row * GRID_COLS + col;
    if (!touchedRef.current.has(idx)) {
      touchedRef.current.add(idx);
      setAttempted(touchedRef.current.size);
    }
  }, []);

  const strokeTo = useCallback(
    (p: Point) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = "#ece6d8";
      ctx.lineWidth = 3;
      const last = lastPointRef.current;
      if (last) {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = "#ece6d8";
        ctx.fill();
      }
      lastPointRef.current = p;
      touchCell(p);
    },
    [touchCell],
  );

  // --- Mouse input --------------------------------------------------------

  const localPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    penDownRef.current = true;
    lastPointRef.current = null;
    strokeTo(localPoint(e));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "mouse" || !penDownRef.current) return;
    strokeTo(localPoint(e));
  };
  const onPointerUp = () => {
    penDownRef.current = false;
    lastPointRef.current = null;
  };

  // --- Camera input (reuses the MediaPipe gesture stream) -----------------

  useEffect(() => {
    if (phase !== "drawing" || mode !== "camera") return;
    let raf = 0;
    const loop = () => {
      const g = gestureRef.current;
      const { w, h } = sizeRef.current;
      const tx = g.smoothedX * w;
      const ty = g.indexTipY * h;
      const e = emaRef.current;
      e.x += (tx - e.x) * 0.4;
      e.y += (ty - e.y) * 0.4;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.x}px, ${e.y}px)`;
        cursorRef.current.style.opacity = g.handVisible ? "1" : "0.25";
      }
      const penDown = g.handVisible && g.pinchActive;
      if (penDown) {
        strokeTo({ x: e.x, y: e.y });
      } else {
        lastPointRef.current = null;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, mode, strokeTo]);

  // Boot the camera when a camera run begins.
  useEffect(() => {
    if (phase === "drawing" && mode === "camera") {
      void visionRef.current?.boot();
    }
  }, [phase, mode, runKey]);

  // Size the canvas + draw the grid on entering a drawing run.
  useEffect(() => {
    if (phase !== "drawing") return;
    // Defer to next frame so the canvas has its laid-out size.
    const id = requestAnimationFrame(sizeCanvas);
    const onResize = () => sizeCanvas();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
    };
  }, [phase, runKey, sizeCanvas]);

  // Countdown timer.
  const finishDrawing = useCallback(() => {
    const url = canvasRef.current?.toDataURL("image/png") ?? null;
    const fluency = touchedRef.current.size;
    recordSession(THIRTY_GAME, fluency, []);
    const sessionCount = loadSessions(THIRTY_GAME).length;
    setReflection(REFLECTION_PROMPTS[sessionCount % REFLECTION_PROMPTS.length]);
    setGallery(url);
    setPicked([]);
    setPhase("reflect");
    playSfx("gameOver");
  }, []);

  useEffect(() => {
    if (phase !== "drawing") return;
    const tick = () => {
      const left = endAtRef.current - performance.now();
      if (left <= 0) {
        setRemaining(0);
        finishDrawing();
      } else {
        setRemaining(left);
      }
    };
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [phase, runKey, finishDrawing]);

  // --- Flow controls ------------------------------------------------------

  const beginRun = useCallback((m: Mode) => {
    unlockAudio();
    touchedRef.current = new Set();
    lastPointRef.current = null;
    penDownRef.current = false;
    setAttempted(0);
    setRemaining(DURATION_MS);
    endAtRef.current = performance.now() + DURATION_MS;
    setMode(m);
    setRunKey((k) => k + 1);
    setPhase("drawing");
    playSfx("start");
  }, []);

  const goAgain = useCallback(() => {
    // A self-imposed constraint pulled from the deck — the classic rut-breaker.
    setConstraint(CONSTRAINTS[Math.floor(Math.random() * CONSTRAINTS.length)]);
    beginRun(mode);
  }, [beginRun, mode]);

  const exportPng = useCallback(() => {
    if (!gallery) return;
    const a = document.createElement("a");
    a.href = gallery;
    a.download = "thirty-circles.png";
    a.click();
  }, [gallery]);

  const togglePick = (c: Category) =>
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const secs = Math.ceil(remaining / 1000);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");
  const skipped = CATEGORIES.filter((c) => !picked.includes(c));

  if (!mounted) return <div className="fixed inset-0" style={{ background: "#000" }} aria-hidden />;
  if (vpBlocked) return <MobileGate />;

  return (
    <div className="relative flex-1 flex flex-col w-full h-screen overflow-hidden" style={{ padding: "16px 18px" }}>
      {/* Focalism: the page defocuses behind the start overlay — no glass veil. */}
      <FocalPlane level={phase === "start" ? 2 : 0} className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="font-mono text-[9px] uppercase tracking-[0.22em] self-center transition-colors hover:text-[var(--accent)]" style={{ color: "var(--ink-dim)" }}>
            ◂ arcade
          </Link>
          <h1 className="font-display text-lg md:text-xl tracking-[0.2em] leading-none" style={{ color: "var(--ink)" }}>
            THIRTY <span style={{ color: "var(--accent)" }}>CIRCLES</span>
          </h1>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--ink-dim)" }}>
            divergent thinking
          </span>
        </div>
        {phase === "drawing" && (
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-dim)" }}>
              filled <span className="font-display" style={{ color: "var(--accent)" }}>{attempted}</span>/{TOTAL_CIRCLES}
            </span>
            <span className="font-display text-lg tracking-[0.1em]" style={{ color: secs <= 20 ? "var(--accent-hot)" : "var(--ink)" }}>
              {mm}:{ss}
            </span>
            <button
              type="button"
              onClick={finishDrawing}
              className="font-display text-[10px] tracking-[0.22em] px-3 py-1.5 rounded-[2px] border transition-colors hover:bg-[rgba(245,182,81,0.14)]"
              style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
            >
              DONE
            </button>
          </div>
        )}
      </header>

      {/* Body */}
      <main className="flex-1 min-h-0 flex flex-col">
        {phase === "drawing" && (
          <div className="flex-1 min-h-0 flex gap-3">
            <div className="relative flex-1 min-h-0">
              {constraint && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-[2px] font-mono text-[10px] uppercase tracking-[0.2em]" style={{ background: "rgba(14,10,20,0.8)", border: "1px solid var(--panel-border)", color: "var(--accent)" }}>
                  constraint · {constraint}
                </div>
              )}
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                className="w-full h-full rounded-[2px] border"
                style={{ borderColor: "var(--panel-border-strong)", background: "var(--board-bg)", cursor: mode === "mouse" ? "crosshair" : "none", touchAction: "none" }}
              />
              {mode === "camera" && (
                <div
                  ref={cursorRef}
                  className="pointer-events-none absolute top-0 left-0 rounded-full"
                  style={{ width: 14, height: 14, marginLeft: -7, marginTop: -7, background: "var(--accent)", boxShadow: "0 0 10px var(--accent)" }}
                />
              )}
            </div>
            {mode === "camera" && (
              <div className="w-[220px] shrink-0 flex flex-col gap-2">
                <VisionFeed ref={visionRef} gestureRef={gestureRef} movementFreezeUntilRef={movementFreezeUntilRef} />
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-center" style={{ color: "var(--ink-dim)" }}>
                  pinch to draw · release to lift
                </p>
              </div>
            )}
          </div>
        )}

        {phase === "reflect" && (
          <ReflectScreen
            gallery={gallery}
            attempted={attempted}
            best={best}
            trend={trend}
            reflection={reflection}
            categories={[...CATEGORIES]}
            picked={picked}
            skipped={skipped}
            onToggle={togglePick}
            onExport={exportPng}
            onAgain={goAgain}
          />
        )}
      </main>
      </FocalPlane>

      {/* Start overlay */}
      {phase === "start" && (
        <StartOverlay
          best={best}
          trend={trend}
          constraint={constraint}
          onMouse={() => beginRun("mouse")}
          onCamera={() => beginRun("camera")}
        />
      )}
    </div>
  );
}

function StartOverlay({
  best,
  trend,
  constraint,
  onMouse,
  onCamera,
}: {
  best: number;
  trend: number[];
  constraint: string | null;
  onMouse: () => void;
  onCamera: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-6 py-6 overflow-y-auto" style={{ background: "rgba(14,10,20,0.55)" }}>
      <Link href="/" className="fixed top-4 left-4 z-[55] font-mono text-[10px] uppercase tracking-[0.24em] px-3 py-2 rounded-[2px] border hover:-translate-y-px transition-transform" style={{ borderColor: "var(--panel-border-strong)", color: "var(--ink-dim)", background: "rgba(0,0,0,0.35)" }}>
        ◂ arcade
      </Link>
      <div className="panel-bg relative rounded-[2px] border w-full overflow-hidden" style={{ maxWidth: 540, borderColor: "var(--panel-border-strong)", boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}>
        <div className="border-b" style={{ borderColor: "var(--panel-border)", height: 84 }}>
          <Vignette kind="circles" tint="var(--c-J)" className="h-full" />
        </div>
        <div className="px-8 py-7">
          <div className="font-display text-[10px] tracking-[0.32em] mb-2 text-center" style={{ color: "var(--accent)" }}>
            ─── divergent thinking ───
          </div>
          <h2 className="font-display tracking-[0.14em] leading-[0.95] mb-3 text-center" style={{ color: "var(--ink)", fontSize: "clamp(30px, 6vw, 46px)" }}>
            THIRTY <span style={{ color: "var(--accent)" }}>CIRCLES</span>
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] leading-relaxed text-center mb-5" style={{ color: "var(--ink-dim)" }}>
            three minutes. thirty circles. turn each into a different thing — a clock, a face, a planet. quantity beats quality. don&apos;t overthink it.
          </p>

          {trend.length >= 2 && (
            <div className="flex items-center justify-between rounded-[2px] border px-3 py-2 mb-5" style={{ borderColor: "var(--panel-border)" }}>
              <div className="flex flex-col">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-dim)" }}>fluency · last {trend.length}</span>
                <span className="font-display text-[12px]" style={{ color: "var(--accent)" }}>best {best}/{TOTAL_CIRCLES}</span>
              </div>
              <Sparkline values={trend} />
            </div>
          )}

          {constraint && (
            <div className="text-center font-mono text-[10px] uppercase tracking-[0.2em] mb-4" style={{ color: "var(--accent)" }}>
              this run&apos;s constraint · {constraint}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button onClick={onCamera} className="font-display tracking-[0.24em] text-sm px-6 py-3.5 border w-full transition-all duration-150 hover:bg-[rgba(245,182,81,0.22)]" style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(245,182,81,0.1)", boxShadow: "0 0 24px rgba(245,182,81,0.18)" }}>
              ▶ DRAW WITH HANDS
            </button>
            <button onClick={onMouse} className="font-mono uppercase tracking-[0.22em] text-[11px] px-6 py-2.5 w-full transition-colors hover:text-[var(--ink)]" style={{ color: "var(--ink-dim)" }}>
              draw with mouse →
            </button>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-center mt-1" style={{ color: "var(--ink-dim)", opacity: 0.8 }}>
              🔒 camera runs on-device · pinch to draw
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReflectScreen({
  gallery,
  attempted,
  best,
  trend,
  reflection,
  categories,
  picked,
  skipped,
  onToggle,
  onExport,
  onAgain,
}: {
  gallery: string | null;
  attempted: number;
  best: number;
  trend: number[];
  reflection: string;
  categories: Category[];
  picked: Category[];
  skipped: Category[];
  onToggle: (c: Category) => void;
  onExport: () => void;
  onAgain: () => void;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto flex justify-center py-2">
      <div className="w-full grid gap-4" style={{ maxWidth: 980, gridTemplateColumns: "1.4fr 1fr" }}>
        {/* Gallery — mounted on a mat, like a framed print */}
        <div
          className="rounded-[2px] border"
          style={{ borderColor: "var(--panel-border-strong)", background: "var(--board-bg)", padding: 14 }}
        >
          {gallery ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gallery}
              alt="your thirty circles"
              className="w-full block rounded-[1px]"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--board-line)" }}
            />
          ) : (
            <div className="p-10 text-center font-mono text-[11px]" style={{ color: "var(--ink-dim)" }}>no drawing captured</div>
          )}
        </div>

        {/* Reflection */}
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: "var(--ink-dim)" }}>fluency</div>
            <div className="font-display" style={{ color: "var(--accent)", fontSize: 40 }}>{attempted}<span style={{ color: "var(--ink-dim)", fontSize: 18 }}>/{TOTAL_CIRCLES}</span></div>
            {trend.length >= 2 && (
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-dim)" }}>best {best}</span>
                <Sparkline values={trend} width={120} height={28} />
              </div>
            )}
          </div>

          {/* Flexibility self-check */}
          <div className="rounded-[2px] border p-3" style={{ borderColor: "var(--panel-border)" }}>
            <div className="font-display text-[10px] tracking-[0.22em] mb-2" style={{ color: "var(--accent)" }}>WHICH DID YOU DRAW?</div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => {
                const on = picked.includes(c);
                return (
                  <button key={c} type="button" onClick={() => onToggle(c)} className="px-2.5 py-1 rounded-[2px] border font-mono text-[10px] uppercase tracking-[0.14em] transition-colors" style={{ borderColor: on ? "var(--accent)" : "var(--panel-border)", color: on ? "var(--accent)" : "var(--ink-dim)", background: on ? "rgba(245,182,81,0.12)" : "transparent" }}>
                    {c}
                  </button>
                );
              })}
            </div>
            {picked.length > 0 && skipped.length > 0 && (
              <p className="font-mono text-[10px] tracking-[0.04em] mt-2 leading-snug" style={{ color: "var(--ink-dim)" }}>
                you skipped <span style={{ color: "var(--ink)" }}>{skipped.join(", ")}</span> — that&apos;s where the unexpected ideas hide.
              </p>
            )}
          </div>

          {/* Rotating reflection prompt */}
          <div className="rounded-[2px] px-3 py-3 flex items-start gap-2" style={{ background: "rgba(245,182,81,0.06)", border: "1px solid var(--panel-border)" }}>
            <span className="font-display text-[10px] mt-px" style={{ color: "var(--accent)" }}>✦</span>
            <p className="font-mono text-[11px] leading-snug" style={{ color: "var(--ink)" }}>{reflection}</p>
          </div>

          <div className="flex flex-col gap-2 mt-1">
            <button onClick={onAgain} className="font-display tracking-[0.24em] text-sm px-6 py-3 border w-full transition-all duration-150 hover:bg-[rgba(245,182,81,0.22)]" style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(245,182,81,0.1)" }}>
              ↻ GO AGAIN — WITH A TWIST
            </button>
            <div className="flex gap-2">
              <button onClick={onExport} disabled={!gallery} className="flex-1 font-mono uppercase tracking-[0.2em] text-[11px] px-4 py-2 border transition-colors disabled:opacity-40 hover:text-[var(--ink)]" style={{ color: "var(--ink-dim)", borderColor: "var(--panel-border)" }}>
                ⤓ save png
              </button>
              <Link href="/" className="flex-1 text-center font-mono uppercase tracking-[0.2em] text-[11px] px-4 py-2 border transition-colors hover:text-[var(--ink)]" style={{ color: "var(--ink-dim)", borderColor: "var(--panel-border)" }}>
                ← arcade
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileGate() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 text-center" style={{ background: "#000" }}>
      <div className="font-display text-[10px] tracking-[0.32em] mb-3" style={{ color: "var(--accent)" }}>─── need more room ───</div>
      <h1 className="font-display tracking-[0.18em] leading-[0.95] mb-4" style={{ color: "var(--ink)", fontSize: "clamp(30px, 8vw, 48px)" }}>
        THIRTY<br /><span style={{ color: "var(--accent)" }}>CIRCLES</span>
      </h1>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] leading-relaxed max-w-[300px]" style={{ color: "var(--ink-dim)" }}>
        thirty circles need a wide canvas.<br />flip to landscape or hop on a laptop.
      </p>
      <Link href="/" className="mt-6 font-mono text-[10px] uppercase tracking-[0.24em] px-4 py-2 border rounded-[2px]" style={{ borderColor: "var(--panel-border-strong)", color: "var(--accent)" }}>◂ back to arcade</Link>
    </div>
  );
}
