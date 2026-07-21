-- ============================================================
-- Migration: make the leaderboard multi-game
-- ============================================================
-- Turns the Tetris-only `scores` table into a generic per-game board.
-- SAFE ON LIVE DATA: additive + backfill only — existing score rows are
-- preserved and their lines/level are folded into the new `meta` blob.
--
-- Run ONCE in the Supabase SQL Editor on the existing project.
-- Idempotent where practical (guards with `if exists` / `if not exists`).
--
-- What changes:
--   scores.game   text  — which game the row belongs to ('tetris', 'eyeball-it', …)
--   scores.meta   jsonb — per-game stats (Tetris: { "lines": n, "level": n })
--   scores.lines / scores.level are dropped (data moves into meta)
--   RPCs reserve_name/players are untouched (one shared identity across games)
-- ============================================================

-- 1. New columns
alter table public.scores add column if not exists game text;
alter table public.scores
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- 2. Backfill existing rows as Tetris, folding lines/level into meta.
--    Guarded so a re-run doesn't clobber already-migrated rows.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'scores'
      and column_name = 'lines'
  ) then
    update public.scores
      set game = coalesce(game, 'tetris'),
          meta = case
                   when meta = '{}'::jsonb
                   then jsonb_build_object('lines', lines, 'level', level)
                   else meta
                 end
      where game is null or meta = '{}'::jsonb;
  else
    update public.scores set game = 'tetris' where game is null;
  end if;
end $$;

-- 3. Enforce game NOT NULL now that every row has one.
alter table public.scores alter column game set not null;

-- 4. Drop the now-redundant Tetris-specific columns (data lives in meta).
alter table public.scores drop column if exists lines;
alter table public.scores drop column if exists level;

-- 5. Re-index for per-game ordering.
drop index if exists public.scores_top;
create index if not exists scores_game_top
  on public.scores (game, score desc, created_at desc);

-- 6. Retire the Tetris-only RPCs; the generic ones replace them.
drop function if exists public.submit_score(text, text, int, int, int, int) cascade;
drop function if exists public.top_scores(int) cascade;

-- 7. Generic submit RPC. Per-game plausibility: Tetris keeps its tight ceiling
--    (read from meta); other games get a relaxed generic ceiling + min-play.
create or replace function public.submit_game_score(
  p_name          text,
  p_token         text,
  p_game          text,
  p_score         int,
  p_meta          jsonb,
  p_play_time_ms  int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stored_token  text;
  v_recent        int;
  v_lines         int;
  v_level         int;
  v_max_plausible int;
begin
  -- Whitelist known games so the board can't be polluted with junk keys.
  if p_game not in ('tetris', 'eyeball-it', 'kern-combat', 'colour-forge') then
    raise exception 'unknown_game';
  end if;

  -- Auth
  select token into v_stored_token
    from public.players
    where name = p_name;
  if v_stored_token is null then
    raise exception 'unknown_name';
  end if;
  if v_stored_token != p_token then
    raise exception 'bad_token';
  end if;

  -- Numeric sanity
  if p_score < 0 or p_play_time_ms < 0 then
    raise exception 'invalid_range';
  end if;

  if p_game = 'tetris' then
    v_lines := coalesce((p_meta->>'lines')::int, 0);
    v_level := coalesce((p_meta->>'level')::int, 1);
    if v_level < 1 or v_lines < 0 then
      raise exception 'invalid_range';
    end if;
    -- Legal max per locked piece is a 4-line clear at level (800 * level);
    -- generous bound leaves headroom for drop bonuses.
    v_max_plausible := (v_lines + 4) * 800 * v_level + (v_level * 1000);
    if p_score > v_max_plausible then
      raise exception 'implausible_score';
    end if;
    if p_play_time_ms < v_lines * 600 then
      raise exception 'implausible_time';
    end if;
  else
    -- Accuracy games score out of a few thousand points at most.
    if p_score > 100000 then
      raise exception 'implausible_score';
    end if;
    -- A real round takes at least a couple of seconds.
    if p_play_time_ms < 2000 then
      raise exception 'implausible_time';
    end if;
  end if;

  -- Rate-limit: one submission per name PER GAME per 10 seconds.
  select count(*) into v_recent
    from public.scores
    where name = p_name
      and game = p_game
      and created_at > now() - interval '10 seconds';
  if v_recent > 0 then
    raise exception 'rate_limited';
  end if;

  insert into public.scores (name, game, score, meta, play_time_ms)
    values (p_name, p_game, p_score, coalesce(p_meta, '{}'::jsonb), p_play_time_ms);
end;
$$;

-- 8. Generic top-scores RPC (best row per player, for one game).
create or replace function public.top_game_scores(p_game text, p_limit int default 10)
returns table (
  rank        int,
  name        text,
  score       int,
  meta        jsonb,
  created_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
  with best as (
    select distinct on (s.name)
      s.name, s.score, s.meta, s.created_at
    from public.scores s
    where s.game = p_game
    order by s.name, s.score desc, s.created_at asc
  )
  select
    cast(row_number() over (order by b.score desc, b.created_at asc) as int) as rank,
    b.name, b.score, b.meta, b.created_at
  from best b
  order by b.score desc, b.created_at asc
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

-- 9. Dedup trigger now keys on (name, game, score, meta).
create or replace function public.dedup_score_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.scores
  where id <> new.id
    and name = new.name
    and game = new.game
    and score = new.score
    and meta = new.meta
    and created_at < new.created_at;
  return new;
end;
$$;

drop trigger if exists scores_dedup_after_insert on public.scores;
create trigger scores_dedup_after_insert
  after insert on public.scores
  for each row execute function public.dedup_score_after_insert();

-- 10. Grant execute to the anon role.
grant execute on function public.submit_game_score(text, text, text, int, jsonb, int) to anon;
grant execute on function public.top_game_scores(text, int) to anon;

-- Done. Existing Tetris scores are preserved and now live under game='tetris'.
