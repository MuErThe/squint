"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { GestureState } from "@/lib/hand/types";

interface StatusIndicatorsProps {
  gestureRef: React.MutableRefObject<GestureState>;
  pollMs?: number;
}

interface PollState {
  track: boolean;
  pinch: boolean;
  drop: boolean;
}

export function StatusIndicators({
  gestureRef,
  pollMs = 90,
}: StatusIndicatorsProps) {
  const [s, setS] = useState<PollState>({
    track: false,
    pinch: false,
    drop: false,
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const g = gestureRef.current;
      const next = {
        track: g.handVisible,
        pinch: g.pinchActive,
        drop: g.dropZoneActive,
      };
      setS((prev) =>
        prev.track === next.track &&
        prev.pinch === next.pinch &&
        prev.drop === next.drop
          ? prev
          : next,
      );
    }, pollMs);
    return () => window.clearInterval(id);
  }, [gestureRef, pollMs]);

  return (
    <div className="flex gap-1.5 flex-wrap">
      <Pill label="TRACK" active={s.track} tone="accent" />
      <Pill label="PINCH" active={s.pinch} tone="hot" />
      <Pill label="DROP" active={s.drop} tone="hot" />
    </div>
  );
}

function Pill({
  label,
  active,
  tone,
}: {
  label: string;
  active: boolean;
  tone: "accent" | "hot";
}) {
  const accent = tone === "hot" ? "var(--accent-hot)" : "var(--accent)";
  return (
    <motion.div
      animate={{
        backgroundColor: active
          ? tone === "hot"
            ? "rgba(255, 120, 73, 0.18)"
            : "rgba(245, 182, 81, 0.18)"
          : "rgba(255, 255, 255, 0.03)",
        boxShadow: active
          ? `0 0 14px ${tone === "hot" ? "rgba(255,120,73,0.55)" : "rgba(245,182,81,0.55)"}, inset 0 0 0 1px ${accent}`
          : "0 0 0 rgba(0,0,0,0)",
      }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="px-2 py-1 rounded-[2px] border font-display text-[9px] tracking-[0.22em] flex items-center gap-1.5"
      style={{
        borderColor: active ? accent : "var(--panel-border)",
        color: active ? accent : "var(--ink-dim)",
      }}
    >
      <motion.span
        animate={{
          scale: active ? [1, 1.4, 1] : 1,
        }}
        transition={{
          duration: active ? 1.2 : 0.2,
          repeat: active ? Infinity : 0,
          ease: "easeInOut",
        }}
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{
          background: active ? accent : "var(--ink-dim)",
        }}
      />
      {label}
    </motion.div>
  );
}
