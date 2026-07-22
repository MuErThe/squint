import type { Metadata } from "next";
import Link from "next/link";
import {
  FocusScaleSpecimen,
  AberrationSpecimen,
  DetentSpecimen,
  RackSpecimen,
  ReticleSpecimen,
} from "./specimens";

export const metadata: Metadata = {
  title: "Focalism — a design language where hierarchy is focus",
  description:
    "Focalism is a UI design language in the lineage of brutalism and glassmorphism: the interface behaves like a lens. Depth is focal distance, transitions are focus racks, colour appears only as signal, and errors fringe with chromatic aberration. The manifesto, the six laws, live specimens and adoption recipes.",
  alternates: { canonical: "./" },
};

const ARTICLE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Focalism — a design language where hierarchy is focus",
  description:
    "The interface is a lens: Focalism replaces shadows and elevation with focal planes, slides with focus racks, and decorative colour with signal colour and chromatic aberration.",
  author: { "@type": "Person", name: "Zabeeh" },
  publisher: { "@type": "Organization", name: "Squint", url: "https://squint.mdzabeeh.com/" },
  mainEntityOfPage: "https://squint.mdzabeeh.com/focalism/",
};

const LAWS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "The interface is a lens",
    body: "Hierarchy is focus. Whatever the user attends to is razor sharp; everything else sits at a measured distance from the focal plane. Attention is not decorated — it is focused.",
  },
  {
    n: "02",
    title: "Depth is focal distance",
    body: "No drop shadows, no elevation stack. A layer's importance is its focus step: attended (fz-0), near (fz-1), far (fz-2), deep field (fz-3). Glassmorphism blurs backgrounds as garnish; Focalism makes depth-of-field the load-bearing structure.",
  },
  {
    n: "03",
    title: "Motion is optical or mechanical",
    body: "Macro transitions are focus racks — the outgoing plane defocuses while the incoming one sharpens. Nothing slides, nothing bounces in from off-screen. Micro interactions are detents: the snap, tick and settle of a fine instrument.",
  },
  {
    n: "04",
    title: "Colour is signal",
    body: "The world is warm near-monochrome. Colour appears only when it means something: green is truth, hot orange is error, an accent is identity. And when something errs or falls out of focus, its edges fringe red-cyan — chromatic aberration, the lens catching the miss. Ration it: when everything fringes, nothing means anything.",
  },
  {
    n: "05",
    title: "Type comes into focus, not into size",
    body: "Hierarchy in text comes from focus and luminance, not from ever-larger headings. Display type is a voice, not a volume knob.",
  },
  {
    n: "06",
    title: "Warm precision",
    body: "A fine instrument in a warm room. Exactness without coldness: charcoal fields, amber focus-light, honest measurements, calm at rest and cinematic only in motion. And the work itself sits on lit paper — play surfaces are light while the room stays dark, because colour and type are judged truly against a light ground. Accessibility is part of the optics — the focused plane always reads, and reduced-motion users get fades instead of racks.",
  },
];

export default function FocalismPage() {
  return (
    <main className="flex-1 overflow-y-auto overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_JSON_LD) }}
      />
      <div className="min-h-full flex flex-col items-center px-5 py-10 md:py-14">
        <article className="w-full" style={{ maxWidth: 760 }}>
          <Link
            href="/"
            className="font-mono text-[9px] uppercase tracking-[0.22em] transition-colors hover:text-[var(--accent)]"
            style={{ color: "var(--ink-dim)" }}
          >
            ◂ back to the arcade
          </Link>

          <div className="font-display text-[10px] tracking-[0.4em] mt-8 mb-3" style={{ color: "var(--accent)" }}>
            ─── a manifesto ───
          </div>
          <h1
            className="font-display tracking-[0.14em] leading-tight mb-5"
            style={{ color: "var(--ink)", fontSize: "clamp(30px, 6vw, 52px)" }}
          >
            FOCAL<span style={{ color: "var(--accent)" }}>ISM</span>
          </h1>
          <p className="font-mono text-[14px] leading-relaxed mb-3" style={{ color: "var(--ink)" }}>
            Brutalism made honesty of raw material. Glassmorphism made light of
            layered glass. <strong>Focalism makes hierarchy of focus itself</strong>:
            the interface behaves like a lens, and what you attend to is simply —
            optically — sharp.
          </p>
          <p className="font-mono text-[12px] leading-relaxed mb-10" style={{ color: "var(--ink-dim)" }}>
            Born inside{" "}
            <Link href="/" className="underline decoration-dotted underline-offset-4" style={{ color: "var(--accent)" }}>
              Squint
            </Link>
            , a training arcade for the designer&apos;s eye — a product about
            perception deserved a design language about perception. Squint is the
            reference implementation; this page is the doctrine. Take it, use it,
            push it further.
          </p>

          <h2 className="font-display text-[14px] tracking-[0.22em] mb-5" style={{ color: "var(--accent)" }}>
            THE SIX LAWS
          </h2>
          <ol className="flex flex-col gap-5 mb-12">
            {LAWS.map((law) => (
              <li key={law.n} className="rounded-[2px] border px-5 py-4" style={{ borderColor: "var(--panel-border)", background: "var(--field-1)" }}>
                <h3 className="font-display text-[13px] tracking-[0.16em] mb-1.5" style={{ color: "var(--ink)" }}>
                  <span style={{ color: "var(--accent)" }}>{law.n}</span> · {law.title.toUpperCase()}
                </h3>
                <p className="font-mono text-[12px] leading-relaxed" style={{ color: "var(--ink-dim)" }}>
                  {law.body}
                </p>
              </li>
            ))}
          </ol>

          <h2 className="font-display text-[14px] tracking-[0.22em] mb-2" style={{ color: "var(--accent)" }}>
            SPECIMENS
          </h2>
          <p className="font-mono text-[11px] leading-relaxed mb-6" style={{ color: "var(--ink-dim)" }}>
            The doctrine, running live. Click, hover, press.
          </p>

          <div className="flex flex-col gap-8 mb-12">
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3" style={{ color: "var(--ink-dim)" }}>
                focal planes — click a plane to attend to it
              </h3>
              <FocusScaleSpecimen />
            </section>
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3" style={{ color: "var(--ink-dim)" }}>
                the focus rack — attention swaps by sharpening
              </h3>
              <RackSpecimen />
            </section>
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3" style={{ color: "var(--ink-dim)" }}>
                chromatic aberration — error fringes like a lens
              </h3>
              <AberrationSpecimen />
            </section>
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3" style={{ color: "var(--ink-dim)" }}>
                detents — micro-interactions with a notch
              </h3>
              <DetentSpecimen />
            </section>
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] mb-3" style={{ color: "var(--ink-dim)" }}>
                the reticle — hover to acquire
              </h3>
              <ReticleSpecimen />
            </section>
          </div>

          <h2 className="font-display text-[14px] tracking-[0.22em] mb-4" style={{ color: "var(--accent)" }}>
            ADOPT IT
          </h2>
          <p className="font-mono text-[12px] leading-relaxed mb-4" style={{ color: "var(--ink-dim)" }}>
            The whole system is a handful of tokens. Start here and derive the rest:
          </p>
          <pre
            className="rounded-[2px] border px-4 py-4 overflow-x-auto font-mono text-[11px] leading-relaxed mb-10"
            style={{ borderColor: "var(--panel-border)", background: "var(--field-1)", color: "var(--ink)" }}
          >{`:root {
  --rack-ms: 340ms;                       /* one easing for every rack */
  --rack-ease: cubic-bezier(.33,0,.15,1);
  --ab-red: rgba(255,70,70,.4);           /* aberration fringes */
  --ab-cyan: rgba(80,220,255,.35);
}
/* focus steps — the depth axis */
.fz-0 { filter: none; }
.fz-1 { filter: blur(2px) brightness(.92) saturate(.95); }
.fz-2 { filter: blur(5px) brightness(.82) saturate(.85); }
.fz-3 { filter: blur(9px) brightness(.68) saturate(.7); }
.fz-0,.fz-1,.fz-2,.fz-3 {
  transition: filter var(--rack-ms) var(--rack-ease);
}
/* error/deep-defocus only — ration it */
.aberrate-text {
  text-shadow: .6px 0 var(--ab-red), -.6px 0 var(--ab-cyan);
}

/* the lit bench — play/work surfaces go light in a dark room */
.paper {
  background: #f2ecdf;             /* warm sketchbook stock */
  color: #2a2118;                  /* drawing ink */
}

/* Rules of thumb:
   - animate blur only during transitions, never at rest
   - never blur a live canvas — dim it instead
   - the focused plane always meets contrast
   - prefers-reduced-motion: fades instead of racks */`}</pre>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-block font-display tracking-[0.24em] text-[13px] px-6 py-3 border transition-all duration-150 hover:bg-[rgba(245,182,81,0.18)]"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "rgba(245,182,81,0.08)" }}
            >
              ▶ SEE IT LIVE — PLAY SQUINT
            </Link>
            <Link
              href="/about"
              className="inline-block font-mono uppercase tracking-[0.2em] text-[11px] px-5 py-3 border transition-colors hover:text-[var(--ink)]"
              style={{ borderColor: "var(--panel-border)", color: "var(--ink-dim)" }}
            >
              about squint →
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
