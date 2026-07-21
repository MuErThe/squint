-- CREATIVE ARCADE leaderboard schema (multi-game)
-- Run this once in the Supabase SQL Editor for a FRESH project.
-- Idempotent: safe to re-run (drops + recreates) — but on a project that
-- already has live scores, run supabase/migrations/2026-add-game-column.sql
-- instead, which preserves existing rows.

-- ============================================================
-- 1. Schema reset
-- ============================================================

drop function if exists public.submit_game_score(text, text, text, int, jsonb, int) cascade;
drop function if exists public.reserve_name(text) cascade;
drop function if exists public.top_game_scores(text, int) cascade;
drop table if exists public.scores cascade;
drop table if exists public.players cascade;

-- ============================================================
-- 2. Tables
--    `players` is a single arcade identity (name + secret token) shared
--    across every game. `scores` is generic: each row belongs to a `game`
--    and carries a `meta` blob of that game's stats.
-- ============================================================

create table public.players (
  -- Stored as TEXT (case-preserving display). Uniqueness is enforced
  -- case-insensitively via the unique index below so "ZAB" and "zab" collide.
  name        text primary key,
  token       text not null,
  created_at  timestamptz not null default now(),
  constraint players_name_len check (char_length(name) between 3 and 16),
  constraint players_name_charset check (name ~ '^[A-Za-z0-9_-]+$')
);

create unique index players_name_ci on public.players ((lower(name)));

create table public.scores (
  id            uuid primary key default gen_random_uuid(),
  name          text  not null references public.players(name) on delete cascade,
  game          text  not null,
  score         int   not null check (score >= 0),
  meta          jsonb not null default '{}'::jsonb,
  play_time_ms  int   not null check (play_time_ms >= 0),
  created_at    timestamptz not null default now()
);

create index scores_game_top on public.scores (game, score desc, created_at desc);
create index scores_by_name on public.scores (name);

-- ============================================================
-- 3. Row-level security
--    Public can READ both tables. All writes go through RPC functions
--    that run with elevated privilege (security definer), so direct
--    INSERT/UPDATE/DELETE from the anon key is blocked.
-- ============================================================

alter table public.players enable row level security;
alter table public.scores  enable row level security;

drop policy if exists "players_read"  on public.players;
drop policy if exists "scores_read"   on public.scores;

create policy "players_read" on public.players for select using (true);
create policy "scores_read"  on public.scores  for select using (true);

-- No INSERT/UPDATE/DELETE policies → only definer functions can write.

-- ============================================================
-- 4. RPC: reserve_name(name) → token
--    One identity used across all games.
-- ============================================================

create or replace function public.reserve_name(p_name text)
returns text
language plpgsql
security definer
-- `extensions` is on the path so we can call gen_random_bytes (pgcrypto).
set search_path = public, extensions
as $$
declare
  v_token text;
  v_lower text;
  v_bad   text;
begin
  if p_name is null then
    raise exception 'name_required';
  end if;

  p_name := trim(p_name);

  if char_length(p_name) < 3 or char_length(p_name) > 16 then
    raise exception 'name_length';
  end if;

  if p_name !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'name_charset';
  end if;

  v_lower := lower(p_name);

  -- Profanity blocklist (substring match, case-insensitive).
  for v_bad in
    select unnest(array[
      'fuck','shit','bitch','asshole','dick','cunt','nigger','nigga',
      'faggot','retard','slut','whore','rape','bastard','nazi','pussy'
    ])
  loop
    if position(v_bad in v_lower) > 0 then
      raise exception 'name_profanity';
    end if;
  end loop;

  if exists (select 1 from public.players where lower(name) = v_lower) then
    raise exception 'name_taken';
  end if;

  v_token := encode(gen_random_bytes(16), 'hex');
  insert into public.players (name, token) values (p_name, v_token);
  return v_token;
end;
$$;

-- ============================================================
-- 5. RPC: submit_game_score(name, token, game, score, meta, play_time_ms)
--    - authenticates name via token
--    - validates plausibility per game (Tetris tight; others relaxed)
--    - 10-second per-player-per-game rate limit
-- ============================================================

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
  if p_game not in ('tetris', 'eyeball-it', 'kern-combat', 'colour-forge') then
    raise exception 'unknown_game';
  end if;

  select token into v_stored_token
    from public.players
    where name = p_name;
  if v_stored_token is null then
    raise exception 'unknown_name';
  end if;
  if v_stored_token != p_token then
    raise exception 'bad_token';
  end if;

  if p_score < 0 or p_play_time_ms < 0 then
    raise exception 'invalid_range';
  end if;

  if p_game = 'tetris' then
    v_lines := coalesce((p_meta->>'lines')::int, 0);
    v_level := coalesce((p_meta->>'level')::int, 1);
    if v_level < 1 or v_lines < 0 then
      raise exception 'invalid_range';
    end if;
    v_max_plausible := (v_lines + 4) * 800 * v_level + (v_level * 1000);
    if p_score > v_max_plausible then
      raise exception 'implausible_score';
    end if;
    if p_play_time_ms < v_lines * 600 then
      raise exception 'implausible_time';
    end if;
  else
    if p_score > 100000 then
      raise exception 'implausible_score';
    end if;
    if p_play_time_ms < 2000 then
      raise exception 'implausible_time';
    end if;
  end if;

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

-- ============================================================
-- 6. RPC: top_game_scores(game, limit) → ordered list
--    Returns each player's BEST score for that game (one row per name).
-- ============================================================

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

-- ============================================================
-- 7. Auto-dedup trigger
--    When a new row is inserted, drop any older row from the SAME player
--    and SAME game with identical (score, meta). Keeps the table tidy
--    without ever touching another player's rows.
-- ============================================================

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

-- ============================================================
-- 8. Permissions: let the anon role call our functions.
-- ============================================================

grant execute on function public.reserve_name(text)                               to anon;
grant execute on function public.submit_game_score(text, text, text, int, jsonb, int) to anon;
grant execute on function public.top_game_scores(text, int)                       to anon;

-- Done. From a fresh Supabase project: open SQL Editor, paste, run.
