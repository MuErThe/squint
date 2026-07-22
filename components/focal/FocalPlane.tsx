"use client";

// Focalism primitives — the interface is a lens.
// A FocalPlane sits at a focus step (0 = attended/sharp … 3 = deep field).
// Changing `level` performs a focus rack via the .fz-* transitions.

import type { CSSProperties, ReactNode } from "react";

export type FocusLevel = 0 | 1 | 2 | 3;

interface FocalPlaneProps {
  level: FocusLevel;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function FocalPlane({ level, className = "", style, children }: FocalPlaneProps) {
  return (
    <div className={`fz-${level} ${className}`} style={style}>
      {children}
    </div>
  );
}

/** The rack easing, for framer-motion consumers. */
export const RACK = { duration: 0.34, ease: [0.33, 0, 0.15, 1] as const };

/**
 * Framer variants for content that ARRIVES by sharpening (never sliding):
 * a plane racks from deep field into focus.
 */
export const sharpenIn = {
  initial: { opacity: 0, filter: "blur(8px)" },
  animate: { opacity: 1, filter: "blur(0px)" },
  exit: { opacity: 0, filter: "blur(6px)" },
};
