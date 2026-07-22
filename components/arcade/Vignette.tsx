// Living previews for the hub cards — one tiny animated scene per game.
// All motion is CSS keyframes (defined in globals.css, frozen under
// prefers-reduced-motion); this component is markup only, so it stays a
// server component and costs nothing at runtime.

export type VignetteKind =
  | "tetris"
  | "eyeball"
  | "kern"
  | "colour"
  | "circles"
  | "warmup";

interface VignetteProps {
  kind: VignetteKind;
  /** CSS colour the scene is keyed to (usually the game's accent var). */
  tint: string;
  className?: string;
}

export function Vignette({ kind, tint, className = "" }: VignetteProps) {
  return (
    <div
      aria-hidden
      className={`vg-anim relative w-full overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(180deg, color-mix(in srgb, ${tint} 8%, transparent), rgba(0,0,0,0.22))`,
      }}
    >
      <svg
        viewBox="0 0 160 72"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full block"
      >
        {SCENES[kind](tint)}
      </svg>
    </div>
  );
}

const INK = "rgba(236,230,216,0.85)";
const DIM = "rgba(236,230,216,0.28)";

const SCENES: Record<VignetteKind, (tint: string) => React.ReactNode> = {
  tetris: (tint) => (
    <>
      {/* settled stack */}
      <g fill={DIM}>
        <rect x="42" y="58" width="10" height="10" />
        <rect x="52" y="58" width="10" height="10" />
        <rect x="62" y="58" width="10" height="10" />
        <rect x="96" y="58" width="10" height="10" />
        <rect x="106" y="58" width="10" height="10" />
        <rect x="106" y="48" width="10" height="10" />
      </g>
      {/* falling T piece */}
      <g style={{ animation: "vg-fall 3.2s ease-in infinite" }} fill={tint}>
        <rect x="66" y="28" width="10" height="10" />
        <rect x="76" y="28" width="10" height="10" />
        <rect x="86" y="28" width="10" height="10" />
        <rect x="76" y="38" width="10" height="10" />
      </g>
      {/* falling I piece, offset cycle */}
      <g
        style={{ animation: "vg-fall 3.2s ease-in 1.6s infinite" }}
        fill={INK}
        opacity="0.5"
      >
        <rect x="118" y="18" width="8" height="8" />
        <rect x="126" y="18" width="8" height="8" />
        <rect x="134" y="18" width="8" height="8" />
      </g>
    </>
  ),

  eyeball: (tint) => (
    <>
      {/* target mark */}
      <rect x="77" y="33" width="6" height="6" fill="none" stroke={tint} strokeWidth="1.2" />
      {/* lock-on ping */}
      <circle
        cx="80"
        cy="36"
        r="12"
        fill="none"
        stroke={tint}
        strokeWidth="1"
        style={{ animation: "vg-ping 3.4s ease-out infinite", transformOrigin: "80px 36px" }}
      />
      {/* wandering crosshair */}
      <g style={{ animation: "vg-seek-x 3.4s ease-in-out infinite" }}>
        <g style={{ animation: "vg-seek-y 3.4s ease-in-out infinite" }}>
          <line x1="80" y1="6" x2="80" y2="66" stroke={INK} strokeWidth="0.8" opacity="0.7" />
          <line x1="20" y1="36" x2="140" y2="36" stroke={INK} strokeWidth="0.8" opacity="0.7" />
        </g>
      </g>
    </>
  ),

  kern: (tint) => (
    <>
      {/* baseline */}
      <line x1="34" y1="52" x2="126" y2="52" stroke={DIM} strokeWidth="1" />
      <g
        fontFamily="var(--font-kern), serif"
        fontWeight="600"
        fontSize="34"
        fill={INK}
      >
        <text x="48" y="51" style={{ animation: "vg-kern-l 4s ease-in-out infinite" }}>
          A
        </text>
        <text x="72" y="51" fill={tint}>
          V
        </text>
        <text x="96" y="51" style={{ animation: "vg-kern-r 4s ease-in-out infinite" }}>
          A
        </text>
      </g>
    </>
  ),

  colour: (tint) => (
    <>
      {/* target chip */}
      <rect x="42" y="16" width="38" height="40" fill={tint} />
      {/* mix chip sweeping hue until the seam disappears */}
      <rect
        x="80"
        y="16"
        width="38"
        height="40"
        fill={tint}
        style={{ animation: "vg-hue 3.6s ease-in-out infinite" }}
      />
      <rect x="42" y="16" width="76" height="40" fill="none" stroke={DIM} strokeWidth="1" />
    </>
  ),

  circles: (tint) => (
    <>
      {[0, 1, 2].map((c) =>
        [0, 1].map((r) => (
          <circle
            key={`${c}-${r}`}
            cx={44 + c * 36}
            cy={22 + r * 28}
            r="11"
            fill="none"
            stroke={DIM}
            strokeWidth="1"
          />
        )),
      )}
      {/* one circle becomes a smiley — stroke-drawn doodle */}
      <g stroke={tint} strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path
          d="M 75 46 Q 80 52 85 46 M 76 40 L 76 42 M 84 40 L 84 42"
          strokeDasharray="60"
          style={{ animation: "vg-draw 3.8s ease-in-out infinite" }}
        />
      </g>
    </>
  ),

  warmup: (tint) => (
    <>
      {/* flame */}
      <path
        d="M 80 14 Q 88 24 84 32 Q 92 30 92 40 Q 92 52 80 52 Q 68 52 68 40 Q 68 32 74 26 Q 78 22 80 14 Z"
        fill={tint}
        opacity="0.9"
        style={{ animation: "vg-flicker 1.6s ease-in-out infinite", transformOrigin: "80px 44px" }}
      />
      {/* four step dots filling in sequence */}
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={i}
          cx={62 + i * 12}
          cy={64}
          r="2.4"
          fill={INK}
          style={{ animation: `vg-dot 3.2s linear ${i * 0.5}s infinite` }}
        />
      ))}
    </>
  ),
};
