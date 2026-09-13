-- ============================================================
-- Rate My Username — leaderboard_entries table + RLS
-- Run this once in the Supabase SQL editor for your project
-- (in addition to supabase_saved_results.sql, which is separate
-- and untouched — this is a new, independent table).
-- ============================================================

create extension if not exists pgcrypto; -- provides gen_random_uuid()

-- One row per user. The existing Check/Rate action upserts this row on
-- every rate — there is no separate "submit to leaderboard" button and
-- no unbounded history: each user has exactly one public leaderboard
-- position, always reflecting their most recent rate result.
create table if not exists public.leaderboard_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users (id) on delete cascade,
  username     text not null,                 -- the @handle that was rated (public)
  score        integer not null check (score >= 0 and score <= 100),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Ranking order: highest score first; ties broken by whoever reached that
-- score first (stable, doesn't reshuffle on every page load), then by id
-- as a final deterministic tiebreaker. The app sorts client-side using
-- this exact order, so the index just makes that sort cheap.
create index if not exists leaderboard_entries_rank_idx
  on public.leaderboard_entries (score desc, updated_at asc, id asc);

alter table public.leaderboard_entries enable row level security;

-- Only signed-in users may read the leaderboard at all (enforces "leaderboard
-- is for signed-in users only" at the database layer, not just in the UI).
-- No email, password, or other account data lives on this table, so a
-- broad "any authenticated user can read" policy exposes nothing sensitive.
create policy "read leaderboard as signed-in user"
  on public.leaderboard_entries
  for select
  to authenticated
  using (true);

create policy "insert own leaderboard entry"
  on public.leaderboard_entries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own leaderboard entry"
  on public.leaderboard_entries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No delete policy — the app never removes a leaderboard entry; a user's
-- position is simply overwritten (upserted) on their next rate.
