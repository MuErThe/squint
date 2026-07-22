# PROJECT_CONTEXT — Squint

## Project goal

**Squint** (https://squint.mdzabeeh.com) — a free, browser-based arcade of
five-minute games that train a designer's instincts: visual accuracy
(Eyeball It), kerning (Kern Combat), colour perception (Colour Forge),
divergent thinking (Thirty Circles), plus the original gesture-controlled
Hand Tetris and a Daily Warm-Up ritual with streaks. Tagline: *train the eye
you trust*. Every scored round ends in a teach-back (truth overlaid on the
attempt + a mistake-matched micro-lesson), progress is tracked locally,
rounds adapt toward weaknesses. The UI is the reference implementation of
**Focalism**, a design language invented for this product (manifesto at
`/focalism`). Grew out of a repo that was originally just "Hand Tetris".

## Current status (all DONE and live)

- Five games + hub + `/warm-up`, `/about` (FAQ), `/focalism` (manifesto) —
  live on **Vercel** at the custom domain; every push to `main` deploys.
- **Focalism UI** shipped: focus-step tokens (`.fz-0..3`), focus-rack
  transitions, detents, reticles, chromatic-aberration error marks, hub
  focus-pull, rail focus-swap in games.
- **Lit artboards**: play surfaces are warm paper (`--paper-*` tokens) with
  ink-safe signal colours (`--truth-ink/--guess-ink/--aim-ink`); Colour
  Forge chips sit on a neutral grey appraisal mat; cabinet stays dark.
- **Leaderboards**: Supabase multi-game schema live (migration applied);
  shared player identity; per-game boards for tetris / eyeball-it /
  kern-combat / colour-forge.
- **SEO/AEO/GEO**: per-route metadata, sitemap.xml, robots.txt (AI crawlers
  welcomed), llms.txt, JSON-LD (WebApplication, FAQPage, Article), 1200×630
  OG image, canonicals.
- **Keep-alive**: daily GH Actions ping of `top_game_scores` keeps the free
  Supabase project awake. Was failing after repo housekeeping (repo secrets
  missing); fixed 2026-07-22 by re-adding `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` as **repository** secrets. Stale
  `BASE_PATH` variable and `github-pages` environment removed.

## Architecture / key decisions

- **Stack**: Next.js 16 (App Router, `output: "export"` — fully static),
  React 19, Tailwind v4, framer-motion, three/R3F (Tetris only), MediaPipe
  Hands via jsDelivr (all tracking on-device).
- **Hosting**: Vercel; **security headers (CSP, frame-ancestors,
  Permissions-Policy camera=self) live in `vercel.json`**, not a meta tag —
  moving them fixed dev-mode HMR (dev needs eval). No BASE_PATH anywhere.
- **Supabase**: `players(name, token)` shared identity + `scores(game,
  score, meta jsonb, play_time_ms)`; writes only via security-definer RPCs
  (`reserve_name`, `submit_game_score`, `top_game_scores`) with per-game
  plausibility checks and a **whitelisted game-id list** — adding a new
  scored game requires updating that SQL whitelist.
- **localStorage**: `hand-tetris/v1/*` is the LEGACY namespace holding
  player name+token — deliberately never renamed (renaming orphans every
  player's auth token; documented in `lib/leaderboard/local.ts`). Learning
  progress under `arcade/v1/progress/<game>`, streak under
  `arcade/v1/warmup-streak`. All per-origin.
- **Design decisions**: Focalism 6 laws (hierarchy = focus; depth = focal
  planes; racks + detents; colour = signal + aberration rationed to errors;
  type by focus not size; warm precision + lit paper artboards). Hybrid
  light mode only (full flip rejected: kills brand + dark-lit WebGL Tetris).
  WebGL/drawing canvases are never blurred — dimmed instead.
- Games are composable: `EyeballGame/KernGame/ColourGame` accept
  `roundCount` + `record` props (warm-up reuses them with `record=false`).

## File map (the load-bearing bits)

- `lib/` — pure logic, no React: `eyeball|kern|colour/engine.ts` (+ types,
  per-game `leaderboard.ts` column configs), `learning/` (progress store,
  adaptive weighting, lessons registry), `leaderboard/` (api, identity,
  local, supabase), `warmup/streak.ts`, `hand/` + `tetris/` (original),
  `audio/sfx.ts`, `thirtycircles/config.ts`.
- `components/arcade/` — `GameShell` (identity/submit/results wrapper),
  `GameLayout` (panel + rail grammar), `RoundReveal`, `RoundDots`,
  `Vignette` (hub card animations), `WarmUpBanner`, `CardStats`, `Sparkline`.
- `components/focal/` — Focalism primitives: `FocalPlane` (+`RACK`,
  `sharpenIn`), `Detent`, `Reticle`.
- `app/` — hub `page.tsx` (bento), game routes each with metadata
  `layout.tsx`, `warm-up`, `about`, `focalism` (+`specimens.tsx`),
  `tetris` (heritage page + focal overlays), `globals.css` (ALL design
  tokens: fields, paper, inks, fz-steps, aberration, bento, game-cols).
- `supabase/schema.sql` (fresh installs) + `supabase/migrations/…` (the
  live-data migration, already applied). `vercel.json` (headers).
  `public/` — og-image, robots, sitemap, llms.txt, sounds.
- `.github/workflows/keepalive.yml` — the only remaining CI.

## Next steps (ordered)

1. **Clean test data**: `delete from scores where name='ZONE-YTAR'; delete
   from players where name='ZONE-YTAR';` in Supabase SQL editor (my test
   account currently tops Eyeball/Kern boards).
2. Submit domain to Google Search Console (+ sitemap) and Bing.
3. Launch push: Product Hunt / design communities; the /focalism manifesto
   is the marketing hook.
4. Ideas parked: dual dark/light theme toggle (needs inline-rgba
   tokenisation sweep), reduced-motion OS-level spot check, mobile/touch
   polish pass, more words/lessons per game.

## Open questions / gotchas

- Dev HMR was historically broken by the old CSP meta tag; now fine, but
  when in doubt verify against `npm run build` + `npx serve out -l 4000`
  (localStorage differs per origin/port!).
- Old `muerthe.github.io/hand-tetris` Pages URL is dead (no redirect).
- Supabase anon key is public by design; RLS + definer RPCs are the actual
  security boundary. GH repo secrets exist only for the keep-alive.
- Tetris page (`app/tetris/page.tsx`) keeps its own start/game-over flow —
  it does NOT use GameShell.
- Tailwind arbitrary values occasionally fail to generate here — one-off
  dimensions are written as inline styles on purpose.

## How to run / test

- `npm run dev` → http://localhost:3000 (needs `.env.local` for the
  leaderboard; degrades gracefully without).
- `npx tsc --noEmit` + `npm run build` (static export to `out/`, root
  paths); production-style check: `npx serve out -l 4000`.
- Deploy: push `main` (Vercel). Keep-alive: Actions → "Supabase keep-alive"
  → Run workflow (manual dispatch supported).
- No test framework wired; engines in `lib/` are pure and testable if ever
  wanted.

## Last updated

2026-07-22 — after: Focalism + lit-artboards shipped, Vercel migration,
SEO/AEO/GEO pass, keep-alive secrets fixed.
