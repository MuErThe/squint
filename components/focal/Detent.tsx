"use client";

// Focalism micro-interaction: the detent. Pressing an instrument control
// snaps a notch and settles — a tiny mechanical truth in an optical world.

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { playSfx } from "@/lib/audio/sfx";

interface DetentProps extends HTMLMotionProps<"button"> {
  /** Play the tick cue on press (uses the existing synth "step"). */
  tick?: boolean;
}

export function Detent({ tick = true, onPointerDown, children, ...rest }: DetentProps) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 900, damping: 30 }}
      onPointerDown={(e) => {
        if (tick) playSfx("step");
        onPointerDown?.(e);
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
