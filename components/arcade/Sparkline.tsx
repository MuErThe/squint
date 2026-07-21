interface SparklineProps {
  /** Values oldest → newest. */
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Tiny trend line for a game's start screen — shows how recent session scores
 * are moving. Renders nothing meaningful below two points.
 */
export function Sparkline({
  values,
  width = 160,
  height = 36,
  className = "",
}: SparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    // Higher score → higher on screen (smaller y).
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = pts[pts.length - 1];
  const improving = values[values.length - 1] >= values[0];
  const stroke = improving ? "var(--c-S)" : "var(--accent-hot)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <circle cx={lastX} cy={lastY} r={2.4} fill={stroke} />
    </svg>
  );
}
