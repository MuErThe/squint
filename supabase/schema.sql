-- HAND TETRIS leaderboard schema
-- Run this once in the Supabase SQL Editor for a fresh project.
-- Idempotent: safe to re-run (drops + recreates).

-- ============================================================
-- 1. Schema reset
-- ============================================================

drop function if exists public.submit_score(text, text, int, int, int, int) cascade;
drop function if exists public.reserve_name(text) cascade;
drop function if exists public.top_scores(int) cascade;
drop table if exists public.scores cascade;
drop table if exists public.players cascade;

-- ============================================================
-- 2. Tables
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
  name          text not null references public.players(name) on delete cascade,
  score         int  not null check (score >= 0),
  lines         int  not null check (lines >= 0),
  level         int  not null check (level >= 1),
  play_time_ms  int  not null check (play_time_ms >= 0),
  created_at    timestamptz not null default now()
);

create index scores_top on public.scores (score desc, created_at desc);
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
--    - validates length + charset
--    - checks the (case-insensitive) name is not taken
--    - rejects entries that match the profanity list
--    - generates a 32-hex-char secret token, stores it, returns it
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
-- 5. RPC: submit_score(name, token, score, lines, level, play_time_ms)
--    - authenticates name via token
--    - validates score plausibility vs lines / level
--    - 10-second per-player rate limit
-- ============================================================

create or replace function public.submit_score(
  p_name          text,
  p_token         text,
  p_score         int,
  p_lines         int,
  p_level         int,
  p_play_time_ms  int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stored_token text;
  v_recent       int;
  v_max_plausible int;
begin
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
  if p_score < 0 or p_lines < 0 or p_level < 1 or p_play_time_ms < 0 then
    raise exception 'invalid_range';
  end if;

  -- Score ceiling. The legal max per single locked piece is a 4-line clear
  -- at the current level (800 * level). The level grows ~1 per 10 lines.
  -- A generous upper bound is `lines * 800 * level + level * 1000`, which
  -- leaves headroom for soft/hard-drop bonuses without admitting wild values.
  v_max_plausible := (p_lines + 4) * 800 * p_level + (p_level * 1000);
  if p_score > v_max_plausible then
    raise exception 'implausible_score';
  end if;

  -- Need at least ~0.6 s of real play per cleared line.
  if p_play_time_ms < p_lines * 600 then
    raise exception 'implausible_time';
  end if;

  -- Rate-limit: one submission per name per 10 seconds.
  select count(*) into v_recent
    from public.scores
    where name = p_name
      and created_at > now() - interval '10 seconds';

  if v_recent > 0 then
    raise exception 'rate_limited';
  end if;

  insert into public.scores (name, score, lines, level, play_time_ms)
    values (p_name, p_score, p_lines, p_level, p_play_time_ms);
end;
$$;

-- ============================================================
-- 6. RPC: top_scores(limit) → ordered list
--    Returns each player's BEST score (one row per name).
-- ============================================================

create or replace function public.top_scores(p_limit int default 10)
returns table (
  rank        int,
  name        text,
  score       int,
  lines       int,
  level       int,
  created_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
  with best as (
    select distinct on (s.name)
      s.name, s.score, s.lines, s.level, s.created_at
    from public.scores s
    order by s.name, s.score desc, s.created_at asc
  )
  select
    cast(row_number() over (order by b.score desc, b.created_at asc) as int) as rank,
    b.name, b.score, b.lines, b.level, b.created_at
  from best b
  order by b.score desc, b.created_at asc
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

-- ============================================================
-- 7. Permissions: let the anon role call our functions.
--    (Reading the tables is already covered by RLS.)
-- ============================================================

grant execute on function public.reserve_name(text)               to anon;
grant execute on function public.submit_score(text, text, int, int, int, int) to anon;
grant execute on function public.top_scores(int)                  to anon;

-- Done. From a fresh Supabase project: open SQL Editor, paste, run.
