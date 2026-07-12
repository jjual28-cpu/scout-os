-- =============================================================================
-- Scout OS — searches (creator-discovery search history)
--
-- Every keyword search is logged here so we can later power "recent searches",
-- "popular searches", and search analytics. One append-only row per search.
-- RLS scopes rows to the searching user. Apply in the Supabase SQL editor.
-- =============================================================================

create table if not exists public.searches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  query        text not null,
  platform     text not null default 'instagram',
  result_count integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists searches_user_idx on public.searches (user_id, created_at desc);
create index if not exists searches_query_idx on public.searches (lower(query));

-- -----------------------------------------------------------------------------
-- Row Level Security — a user may only read/insert their OWN searches
-- -----------------------------------------------------------------------------
alter table public.searches enable row level security;

drop policy if exists "searches_select_own" on public.searches;
create policy "searches_select_own" on public.searches
  for select using (auth.uid() = user_id);

drop policy if exists "searches_insert_own" on public.searches;
create policy "searches_insert_own" on public.searches
  for insert with check (auth.uid() = user_id);
