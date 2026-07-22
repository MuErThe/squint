"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COLS = 3;
const ROWS = 2;
const TOTAL = COLS * ROWS; // 6
const SPRINT_MS = 60_000;

type Point = { x: number; y: number };

/**
 * A 60-second, six-circle sprint of Thirty Circles for the daily warm-up.
 * Mouse-only, no reflection — reports how many circles got ink.
 */
export function ThirtyCirclesSprint({ onFinish }: { onFinish: (fluency: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const lastRef = useRef<Point | null>(null);
  const downRef = useRef(false);
  const touchedRef = useRef<Set<number>>(new Set());
  const endAtRef = useRef(0);
  const [remaining, setRemaining] = useState(SPRINT_MS);
  const [attempted, setAttempted] = useState(0);
  const doneRef = useRef(false);

  const drawGrid = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const cw = w / COLS;
    const ch = h / ROWS;
    const r = Math.min(cw, ch) * 0.36;
    ctx.strokeStyle = "rgba(245,182,81,0.22)";
    ctx.lineWidth = 1.25;
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        ctx.beginPath();
        ctx.arc((col + 0.5) * cw, (row + 0.5) * ch, r, 0, Math.PI * 2);
        ctx.stroke();
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

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onFinish(touchedRef.current.size);
  }, [onFinish]);

  useEffect(() => {
    endAtRef.current = performance.now() + SPRINT_MS;
    const id = requestAnimationFrame(sizeCanvas);
    const onResize = () => sizeCanvas();
    window.addEventListener("resize", onResize);
    const tick = setInterval(() => {
      const left = endAtRef.current - performance.now();
      if (left <= 0) {
        setRemaining(0);
        finish();
      } else setRemaining(left);
    }, 200);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
      clearInterval(tick);
    };
  }, [sizeCanvas, finish]);

  const touch = (p: Point) => {
    const { w, h } = sizeRef.current;
    const col = Math.floor((p.x / w) * COLS);
    const row = Math.floor((p.y / h) * ROWS);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    const idx = row * COLS + col;
    if (!touchedRef.current.has(idx)) {
      touchedRef.current.add(idx);
      setAttempted(touchedRef.current.size);
    }
  };
  const strokeTo = (p: Point) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#ece6d8";
    ctx.lineWidth = 3;
    const last = lastRef.current;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    lastRef.current = p;
    touch(p);
  };
  const local = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const mm = Math.floor(Math.ceil(remaining / 1000) / 60);
  const ss = String(Math.ceil(remaining / 1000) % 60).padStart(2, "0");

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-center justify-between shrink-0">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-dim)" }}>
          six circles · a different thing in each
        </span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--ink-dim)" }}>
            filled <span className="font-display" style={{ color: "var(--accent)" }}>{attempted}</span>/{TOTAL}
          </span>
          <span className="font-display text-lg" style={{ color: remaining <= 15000 ? "var(--accent-hot)" : "var(--ink)" }}>
            {mm}:{ss}
          </span>
          <button
            type="button"
            onClick={finish}
            className="font-display text-[10px] tracking-[0.22em] px-3 py-1.5 rounded-[2px] border transition-colors hover:bg-[rgba(245,182,81,0.14)]"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            DONE
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          downRef.current = true;
          lastRef.current = null;
          strokeTo(local(e));
        }}
        onPointerMove={(e) => {
          if (downRef.current) strokeTo(local(e));
        }}
        onPointerUp={() => {
          downRef.current = false;
          lastRef.current = null;
        }}
        className="flex-1 min-h-0 w-full rounded-[2px] border"
        style={{ borderColor: "var(--panel-border-strong)", background: "rgba(0,0,0,0.2)", cursor: "crosshair", touchAction: "none" }}
      />
    </div>
  );
}
