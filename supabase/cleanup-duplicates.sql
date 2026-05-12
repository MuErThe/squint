-- One-shot leaderboard cleanup.
-- Run inside Supabase SQL Editor. Safe to re-run.
--
-- The default mode below is conservative: it collapses duplicates only
-- within the SAME player. The aggressive mode (commented out) also
-- collapses identical stats across different player names — useful when
-- a single person registered under more than one spelling.

-- ============================================================
-- Mode A (safe): per-player dedup.
-- Keep only the most recent row per (name, score, lines, level) tuple.
-- ============================================================

with ranked as (
  select id,
         row_number() over (
           partition by name, score, lines, level
           order by created_at desc, id desc
         ) as rn
  from public.scores
)
delete from public.scores s
using ranked r
where s.id = r.id
  and r.rn > 1;

-- ============================================================
-- Mode B (aggressive): cross-player dedup. UNCOMMENT to apply.
-- Keep only the most recent row per (score, lines, level) tuple,
-- regardless of player. Use when you know players reused names.
-- WARNING: collapses legitimate ties between distinct players.
-- ============================================================

-- with ranked as (
--   select id,
--          row_number() over (
--            partition by score, lines, level
--            order by created_at desc, id desc
--          ) as rn
--   from public.scores
-- )
-- delete from public.scores s
-- using ranked r
-- where s.id = r.id
--   and r.rn > 1;

-- ============================================================
-- Reporting: how many rows remain per player after cleanup.
-- ============================================================

select name, count(*) as runs, max(score) as best
from public.scores
group by name
order by best desc, name asc;
