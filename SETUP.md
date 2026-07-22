# Hand Tetris — Setup & Deploy

This is a static Next.js app. The game runs entirely in the browser; the public
leaderboard is backed by **Supabase** (free tier). With env vars unset, the game
still works — scores just stay on the local device.

## 1. Supabase project

1. Create a free project at https://supabase.com.
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the
   `players` + `scores` tables, RLS policies, and the three RPC functions
   (`reserve_name`, `submit_score`, `top_scores`).
3. Open **Project Settings → API** and copy:
   - the **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - the **anon public** API key

The anon key is **safe to ship in the client bundle** — all writes go through
RPC functions running with elevated privilege, and row-level security blocks
direct table writes from anon.

## 2. Local development

```bash
cp .env.local.example .env.local
# edit .env.local — paste your Supabase URL + anon key
npm install
npm run dev
```

Open http://localhost:3000.

## 3. Build static site

```bash
npm run build
```

Output lands in `out/`. Serve it with any static host.

## 4. Deploy to Vercel

The site deploys as a static export (`output: "export"`); Vercel builds it
with plain `npm run build` and serves `out/`.

1. Import the GitHub repo at **vercel.com/new** (framework auto-detects as
   Next.js — keep the defaults).
2. Under **Project → Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Under **Project → Settings → Domains**, add your domain (e.g.
   `squint.mdzabeeh.com`) and create the DNS record Vercel shows you
   (a `CNAME` to `cname.vercel-dns.com`).
4. Every push to `main` deploys production; other branches get preview URLs.

Security headers (CSP, `frame-ancestors`, `Permissions-Policy`) are set as
real response headers in `vercel.json` — if you self-host elsewhere, port
those headers to your host's config.

Hosting elsewhere still works: `BASE_PATH=/sub-path npm run build` for a
sub-path static host, then publish `out/`.

## 5. Anti-cheat — what's in place

- **Per-player token** issued by `reserve_name`. Scores must be submitted with
  the matching token, so a stranger can't post under your name.
- **Score plausibility** — server rejects values larger than
  `(lines + 4) * 800 * level + level * 1000`. That covers the legal range
  (max single drop is an 800·level tetris) plus comfortable headroom for
  soft/hard-drop bonuses.
- **Play-time minimum** — at least 600 ms of real play per cleared line.
- **Rate limit** — one submission per player per 10 seconds.
- **Profanity gate** — client-side blocklist + server-side substring check.
- **Charset** — names limited to `[A-Za-z0-9_-]`, 3–16 chars, unique
  (case-insensitive).

## 6. Keeping the free-tier project awake

Supabase pauses free projects after ~7 days without API activity (the
leaderboard goes offline and the project URL stops resolving). Two parts:

- **If it's already paused** — log into https://supabase.com/dashboard, open
  the project, and click **Restore**. Data survives a pause. (A project left
  paused for ~90 days can be deleted — then re-create it, re-run
  `supabase/schema.sql`, and update the repo secrets.)
- **Prevention** — `.github/workflows/keepalive.yml` pings the read-only
  `top_scores` RPC twice a week (Mon + Thu), which counts as activity. It
  uses the same repo secrets as the deploy workflow. If a ping fails, GitHub
  emails the repo owner. Note: GitHub disables cron workflows in repos with
  no commits for 60 days — it emails a warning first, and any push (or
  clicking "Enable" in the Actions tab) re-arms it.

## 7. Resetting things

- **Wipe a player from your browser** — open DevTools → Application →
  Local Storage → delete keys under `hand-tetris/v1/`.
- **Wipe the whole leaderboard** — in Supabase SQL Editor:
  `truncate scores; truncate players cascade;`
- **Re-run the schema** — re-running `supabase/schema.sql` drops and recreates
  cleanly (it's idempotent).
