"use client";

// Focalism targeting: corner brackets that fade in when a zone is hovered
// or focused — the lens acquiring its subject.

import type { ReactNode } from "react";

interface ReticleProps {
  className?: string;
  /** Corner colour (defaults to the focus-light). */
  colour?: string;
  children: ReactNode;
}

export function Reticle({ className = "", colour = "var(--accent)", children }: ReticleProps) {
  return (
    <div className={`group/reticle relative ${className}`}>
      {children}
      {(["tl", "tr", "bl", "br"] as const).map((pos) => {
        const isTop = pos.startsWith("t");
        const isLeft = pos.endsWith("l");
        return (
          <span
            key={pos}
            aria-hidden
            className="pointer-events-none absolute w-2.5 h-2.5 opacity-0 transition-opacity duration-200 group-hover/reticle:opacity-100 group-focus-within/reticle:opacity-100"
            style={{
              top: isTop ? 2 : undefined,
              bottom: isTop ? undefined : 2,
              left: isLeft ? 2 : undefined,
              right: isLeft ? undefined : 2,
              borderTop: isTop ? `1px solid ${colour}` : undefined,
              borderBottom: isTop ? undefined : `1px solid ${colour}`,
              borderLeft: isLeft ? `1px solid ${colour}` : undefined,
              borderRight: isLeft ? undefined : `1px solid ${colour}`,
            }}
          />
        );
      })}
    </div>
  );
}
