import Link from "next/link";
import { WarmUpBanner } from "@/components/arcade/WarmUpBanner";
import { CardStats } from "@/components/arcade/CardStats";
import { Vignette, type VignetteKind } from "@/components/arcade/Vignette";

interface Game {
  href: string;
  area: string;
  title: string;
  /** Accent-coloured trailing word in the wordmark. */
  titleAccent?: string;
  /** The skill it trains — the pedagogical hook. */
  trains: string;
  /** One-line pitch. */
  blurb: string;
  /** CSS var of the card's accent tint. */
  tint: string;
  vignette: VignetteKind;
  featured?: boolean;
  /** Progress key for games that track local history (enables the trend footer). */
  gameId?: string;
  /** Unit suffix for the best-score readout (e.g. "/30"). */
  unit?: string;
}

const GAMES: Game[] = [
  {
    href: "/tetris",
    area: "tetris",
    title: "HAND",
    titleAccent: "TETRIS",
    trains: "spatial planning · hand–eye",
    blurb:
      "Stack falling blocks with your bare hands — your webcam is the controller.",
    tint: "var(--c-I)",
    vignette: "tetris",
    featured: true,
  },
  {
    href: "/eyeball-it",
    area: "eyeball",
    title: "EYEBALL",
    titleAccent: "IT",
    trains: "the trained eye",
    blurb:
      "Bisect, centre and align by feel, then see your error measured in pixels.",
    tint: "var(--c-S)",
    vignette: "eyeball",
    gameId: "eyeball-it",
  },
  {
    href: "/kern-combat",
    area: "kern",
    title: "KERN",
    titleAccent: "COMBAT",
    trains: "typographic craft",
    blurb:
      "Space letters until they look right — graded against a typographer's eye.",
    tint: "var(--c-T)",
    vignette: "kern",
    gameId: "kern-combat",
  },
  {
    href: "/colour-forge",
    area: "colour",
    title: "COLOUR",
    titleAccent: "FORGE",
    trains: "colour perception",
    blurb:
      "Mix to match a target colour and learn which way your own eye tends to lie.",
    tint: "var(--c-Z)",
    vignette: "colour",
    gameId: "colour-forge",
  },
  {
    href: "/thirty-circles",
    area: "circles",
    title: "THIRTY",
    titleAccent: "CIRCLES",
    trains: "divergent thinking",
    blurb:
      "Thirty circles, thirty different things, one ticking clock. Beat the blank page.",
    tint: "var(--c-J)",
    vignette: "circles",
    gameId: "thirty-circles",
    unit: "/30",
  },
];

export default function Hub() {
  return (
    <main className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="min-h-full flex flex-col items-center px-5 py-10 md:py-12">
        {/* Wordmark — the I is the eye */}
        <div
          className="font-display text-[10px] tracking-[0.4em] mb-3"
          style={{ color: "var(--accent)" }}
        >
          ─── train the eye you trust ───
        </div>
        <h1
          className="font-display tracking-[0.16em] leading-[0.95] text-center mb-3"
          style={{ color: "var(--ink)", fontSize: "clamp(34px, 8vw, 60px)" }}
        >
          SQU
          <span
            className="focal-breathe"
            style={{
              color: "var(--accent)",
              textShadow: "0 0 22px rgba(245,182,81,0.35)",
            }}
          >
            I
          </span>
          NT
        </h1>
        <p
          className="font-mono text-[11px] md:text-[12px] uppercase tracking-[0.2em] text-center mb-8"
          style={{ color: "var(--ink-dim)", maxWidth: 440 }}
        >
          five-minute games that sharpen a designer's eye, hand and imagination.
        </p>

        {/* Bento */}
        <div className="hub-bento">
          <WarmUpBanner />
          {GAMES.map((g) => (
            <GameCard key={g.href} game={g} />
          ))}
        </div>

        <p
          className="font-mono text-[9px] uppercase tracking-[0.22em] mt-10 text-center"
          style={{ color: "var(--ink-dim)", opacity: 0.7 }}
        >
          🔒 camera games run entirely on-device · nothing leaves your browser
        </p>
        <Link
          href="/about"
          className="font-mono text-[9px] uppercase tracking-[0.22em] mt-2 transition-colors hover:text-[var(--accent)]"
          style={{ color: "var(--ink-dim)" }}
        >
          what is squint? →
        </Link>
      </div>
    </main>
  );
}

function GameCard({ game }: { game: Game }) {
  return (
    <Link
      href={game.href}
      className="bento-card group panel-bg rounded-[2px] overflow-hidden flex flex-col"
      style={{ "--tint": game.tint, gridArea: game.area } as React.CSSProperties}
    >
      {/* Living preview */}
      <div
        className={game.featured ? "flex-1" : "shrink-0"}
        style={{ minHeight: game.featured ? 150 : 88 }}
      >
        <Vignette kind={game.vignette} tint={game.tint} className="h-full" />
      </div>

      <div className="flex flex-col gap-2 p-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <span
            className="font-mono text-[8px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-[2px] border"
            style={{ color: game.tint, borderColor: "var(--panel-border)" }}
          >
            {game.trains}
          </span>
          <span
            className="font-display text-[8px] tracking-[0.2em] px-2 py-0.5 rounded-[2px]"
            style={{ color: "#1a1108", background: "var(--accent)" }}
          >
            LIVE
          </span>
        </div>

        <h2
          className="font-display tracking-[0.12em] leading-none"
          style={{ color: "var(--ink)", fontSize: game.featured ? 26 : 20 }}
        >
          {game.title}
          {game.titleAccent && (
            <>
              {" "}
              <span style={{ color: "var(--accent)" }}>{game.titleAccent}</span>
            </>
          )}
        </h2>

        <p
          className="font-mono text-[10.5px] leading-snug"
          style={{ color: "var(--ink-dim)" }}
        >
          {game.blurb}
        </p>

        <span
          className="font-display text-[10px] tracking-[0.24em] transition-transform group-hover:translate-x-0.5"
          style={{ color: "var(--accent)" }}
        >
          ▶ PLAY
        </span>

        {game.gameId && <CardStats gameId={game.gameId} unit={game.unit} />}
      </div>
    </Link>
  );
}
