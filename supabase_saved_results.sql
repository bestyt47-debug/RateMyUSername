-- ============================================================
-- Rate My Username — saved_results table + RLS
-- Run this once in the Supabase SQL editor for your project.
-- ============================================================

create extension if not exists pgcrypto; -- provides gen_random_uuid()

create table if not exists public.saved_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  username     text not null,
  score        integer,                 -- null for result types with no numeric score (e.g. roast)
  result_type  text not null check (result_type in ('rate', 'roast', 'gamecard')),
  result_data  jsonb not null default '{}'::jsonb,  -- the extra bits per type (categories/topCat, roast text/level, gamecard game/bio/style)
  dedupe_key   text not null,           -- app-computed fingerprint of the exact result, used to avoid duplicate saves
  created_at   timestamptz not null default now()
);

-- one save per (user, exact result) — re-clicking "save" on the same
-- result is a no-op instead of creating a new row
create unique index if not exists saved_results_user_dedupe_idx
  on public.saved_results (user_id, dedupe_key);

-- fast "show my saved results" lookups, most recent first
create index if not exists saved_results_user_created_idx
  on public.saved_results (user_id, created_at desc);

alter table public.saved_results enable row level security;

create policy "select own saved_results"
  on public.saved_results
  for select
  using (auth.uid() = user_id);

create policy "insert own saved_results"
  on public.saved_results
  for insert
  with check (auth.uid() = user_id);

create policy "delete own saved_results"
  on public.saved_results
  for delete
  using (auth.uid() = user_id);

-- No update policy is created — the app never edits a saved result in
-- place, so without an update policy RLS blocks all updates by default
-- (including any future attempt to modify someone else's row).
