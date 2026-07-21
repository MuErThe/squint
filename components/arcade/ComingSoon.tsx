import Link from "next/link";

interface ComingSoonProps {
  /** Game title, e.g. "EYEBALL IT". */
  title: string;
  /** One-line description of what the game trains. */
  blurb: string;
  /** Accent-coloured second word in the title, if you want a split wordmark. */
}

/**
 * Placeholder shown at a game's route before the game itself is built.
 * Keeps navigation from the hub working (no 404s) and previews the pitch.
 */
export function ComingSoon({ title, blurb }: ComingSoonProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-5">
      <Link
        href="/"
        className="font-mono text-[9px] uppercase tracking-[0.22em] transition-colors hover:text-[var(--accent)]"
        style={{ color: "var(--ink-dim)" }}
      >
        ◂ arcade
      </Link>

      <div
        className="font-display text-[10px] tracking-[0.32em]"
        style={{ color: "var(--accent)" }}
      >
        ─── in the workshop ───
      </div>

      <h1
        className="font-display tracking-[0.18em] leading-[0.95]"
        style={{ color: "var(--ink)", fontSize: "clamp(30px, 7vw, 52px)" }}
      >
        {title}
      </h1>

      <p
        className="font-mono text-[11px] uppercase tracking-[0.18em] leading-relaxed max-w-[360px]"
        style={{ color: "var(--ink-dim)" }}
      >
        {blurb}
      </p>

      <div
        className="font-display text-[11px] tracking-[0.28em] px-4 py-2 rounded-[2px] border"
        style={{
          color: "var(--accent)",
          borderColor: "var(--panel-border-strong)",
          background: "rgba(245,182,81,0.06)",
        }}
      >
        COMING SOON
      </div>
    </div>
  );
}
