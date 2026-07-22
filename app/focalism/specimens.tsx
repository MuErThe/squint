"use client";

// Live specimens for the Focalism manifesto — the doctrine, demonstrated.

import { useState } from "react";
import { Detent } from "@/components/focal/Detent";
import { Reticle } from "@/components/focal/Reticle";
import type { FocusLevel } from "@/components/focal/FocalPlane";

const STEP_LABELS = ["fz-0 · attended", "fz-1 · near", "fz-2 · far", "fz-3 · deep"];

/** Law 1–2: focus steps — click a plane to attend to it. */
export function FocusScaleSpecimen() {
  const [focused, setFocused] = useState(0);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {STEP_LABELS.map((label, i) => {
        // Distance from the attended plane decides the focus step.
        const level = Math.min(3, Math.abs(i - focused)) as FocusLevel;
        return (
          <button
            key={label}
            type="button"
            onClick={() => setFocused(i)}
            className={`fz-${level} rounded-[2px] border px-3 py-6 text-center cursor-pointer`}
            style={{
              borderColor: i === focused ? "var(--accent)" : "var(--panel-border)",
              background: "var(--field-2)",
              pointerEvents: "auto", // stay clickable even when defocused
            }}
          >
            <span className="font-display text-[12px] tracking-[0.18em] block mb-1" style={{ color: i === focused ? "var(--accent)" : "var(--ink)" }}>
              PLANE {i}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--ink-dim)" }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Law 4: colour is signal — aberration marks error, never decoration. */
export function AberrationSpecimen() {
  const [erring, setErring] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        className={`rounded-[2px] border px-6 py-5 ${erring ? "aberrate-edge" : ""}`}
        style={{ borderColor: erring ? "var(--accent-hot)" : "var(--panel-border)", background: "var(--field-2)" }}
      >
        <span
          className={`font-display text-[16px] tracking-[0.16em] ${erring ? "aberrate-text" : ""}`}
          style={{ color: erring ? "var(--accent-hot)" : "var(--ink)" }}
        >
          {erring ? "OFF BY 12%" : "DEAD CENTRE"}
        </span>
      </div>
      <Detent
        type="button"
        onClick={() => setErring((e) => !e)}
        className="font-display text-[11px] tracking-[0.22em] px-4 py-2.5 border rounded-[2px] cursor-pointer"
        style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(245,182,81,0.08)" }}
      >
        {erring ? "CORRECT IT" : "MISS THE MARK"}
      </Detent>
    </div>
  );
}

/** Law 3: detents — press to feel the notch. */
export function DetentSpecimen() {
  const [count, setCount] = useState(0);
  return (
    <div className="flex items-center gap-4">
      <Detent
        type="button"
        onClick={() => setCount((c) => c + 1)}
        className="font-display text-[12px] tracking-[0.24em] px-6 py-3 border rounded-[2px] cursor-pointer"
        style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(245,182,81,0.1)" }}
      >
        TURN THE DIAL
      </Detent>
      <span className="font-mono text-[11px] tracking-[0.1em]" style={{ color: "var(--ink-dim)" }}>
        {count} detent{count === 1 ? "" : "s"} clicked
      </span>
    </div>
  );
}

/** Law 3 (macro): the focus rack — attention swaps by sharpening, not sliding. */
export function RackSpecimen() {
  const [side, setSide] = useState<0 | 1>(0);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {["THE PLAYFIELD", "THE REVEAL"].map((label, i) => (
          <div
            key={label}
            className={`fz-${side === i ? 0 : 1} rounded-[2px] border px-4 py-8 text-center`}
            style={{ borderColor: side === i ? "var(--accent)" : "var(--panel-border)", background: "var(--field-2)" }}
          >
            <span className="font-display text-[13px] tracking-[0.18em]" style={{ color: side === i ? "var(--ink)" : "var(--ink-dim)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
      <Detent
        type="button"
        onClick={() => setSide((s) => (s === 0 ? 1 : 0))}
        className="self-start font-display text-[11px] tracking-[0.22em] px-4 py-2.5 border rounded-[2px] cursor-pointer"
        style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(245,182,81,0.08)" }}
      >
        RACK FOCUS ⟷
      </Detent>
    </div>
  );
}

/** Targeting: the reticle acquires whatever you hover. */
export function ReticleSpecimen() {
  return (
    <div className="flex flex-wrap gap-3">
      {["EYE", "TYPE", "COLOUR"].map((label) => (
        <Reticle key={label} className="rounded-[2px]">
          <div
            className="rounded-[2px] border px-8 py-6 text-center"
            style={{ borderColor: "var(--panel-border)", background: "var(--field-2)" }}
          >
            <span className="font-display text-[12px] tracking-[0.2em]" style={{ color: "var(--ink)" }}>
              {label}
            </span>
          </div>
        </Reticle>
      ))}
    </div>
  );
}
