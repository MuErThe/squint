import { ReactNode } from "react";

interface PanelFrameProps {
  label: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  rightSlot?: ReactNode;
  /** Subtle subtitle shown below the label (uppercase mono, dim). */
  hint?: string;
}

export function PanelFrame({
  label,
  children,
  className = "",
  contentClassName = "",
  rightSlot,
  hint,
}: PanelFrameProps) {
  return (
    <div
      className={`panel-bg relative rounded-[2px] border overflow-hidden ${className}`}
      style={{ borderColor: "var(--panel-border)" }}
    >
      <CornerBracket pos="tl" />
      <CornerBracket pos="tr" />
      <CornerBracket pos="bl" />
      <CornerBracket pos="br" />

      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <div className="flex flex-col">
          <span
            className="font-display text-[10px] tracking-[0.22em]"
            style={{ color: "var(--accent)" }}
          >
            {label}
          </span>
          {hint && (
            <span
              className="font-mono text-[9px] uppercase tracking-[0.16em] -mt-0.5"
              style={{ color: "var(--ink-dim)" }}
            >
              {hint}
            </span>
          )}
        </div>
        <div className="flex-1 dashed-rule" />
        {rightSlot}
      </div>

      <div className={`px-4 pb-4 ${contentClassName}`}>{children}</div>
    </div>
  );
}

function CornerBracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const map: Record<typeof pos, string> = {
    tl: "top-1.5 left-1.5",
    tr: "top-1.5 right-1.5",
    bl: "bottom-1.5 left-1.5",
    br: "bottom-1.5 right-1.5",
  } as const;
  const isLeft = pos.endsWith("l");
  const isTop = pos.startsWith("t");
  return (
    <div className={`pointer-events-none absolute w-3 h-3 ${map[pos]}`}>
      <div
        className="absolute w-3 h-px"
        style={{
          background: "var(--accent)",
          top: isTop ? 0 : "auto",
          bottom: isTop ? "auto" : 0,
          left: isLeft ? 0 : "auto",
          right: isLeft ? "auto" : 0,
          opacity: 0.7,
        }}
      />
      <div
        className="absolute w-px h-3"
        style={{
          background: "var(--accent)",
          top: isTop ? 0 : "auto",
          bottom: isTop ? "auto" : 0,
          left: isLeft ? 0 : "auto",
          right: isLeft ? "auto" : 0,
          opacity: 0.7,
        }}
      />
    </div>
  );
}
