-- =============================================================================
-- Scout OS — MVP user data (profiles, saved_opportunities, dm_drafts)
--
-- These tables back the "same account, same data on any computer" sync. They are
-- NOT managed by Prisma — apply this file directly in the Supabase SQL editor
-- (or `supabase db push`). Every table is protected by Row Level Security so a
-- user can only see and mutate their own rows.
-- =============================================================================

-- gen_random_uuid() is available in Postgres 13+ / Supabase by default.

-- -----------------------------------------------------------------------------
-- profiles — one row per auth user
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- saved_opportunities — a saved opportunity + the user's classification
-- -----------------------------------------------------------------------------
create table if not exists public.saved_opportunities (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opportunity_id     text not null,
  name               text not null,
  kind               text,
  platform           text,
  reason             text,
  score              integer,
  recommended_action text,
  status             text not null default '미검토',
  note               text default '',
  raw_data           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create index if not exists saved_opportunities_user_idx
  on public.saved_opportunities (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- dm_drafts — a generated DM draft per opportunity
-- -----------------------------------------------------------------------------
create table if not exists public.dm_drafts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opportunity_id text not null,
  content        text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create index if not exists dm_drafts_user_idx on public.dm_drafts (user_id);

-- -----------------------------------------------------------------------------
-- Row Level Security — a user may only read/write their OWN rows
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.dm_drafts           enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- saved_opportunities (select / insert / update / delete)
drop policy if exists "saved_select_own" on public.saved_opportunities;
create policy "saved_select_own" on public.saved_opportunities
  for select using (auth.uid() = user_id);

drop policy if exists "saved_insert_own" on public.saved_opportunities;
create policy "saved_insert_own" on public.saved_opportunities
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_update_own" on public.saved_opportunities;
create policy "saved_update_own" on public.saved_opportunities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_delete_own" on public.saved_opportunities;
create policy "saved_delete_own" on public.saved_opportunities
  for delete using (auth.uid() = user_id);

-- dm_drafts (select / insert / update / delete)
drop policy if exists "drafts_select_own" on public.dm_drafts;
create policy "drafts_select_own" on public.dm_drafts
  for select using (auth.uid() = user_id);

drop policy if exists "drafts_insert_own" on public.dm_drafts;
create policy "drafts_insert_own" on public.dm_drafts
  for insert with check (auth.uid() = user_id);

drop policy if exists "drafts_update_own" on public.dm_drafts;
create policy "drafts_update_own" on public.dm_drafts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "drafts_delete_own" on public.dm_drafts;
create policy "drafts_delete_own" on public.dm_drafts
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user signs up
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Keep updated_at fresh on every row update
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists saved_set_updated_at on public.saved_opportunities;
create trigger saved_set_updated_at
  before update on public.saved_opportunities
  for each row execute function public.set_updated_at();

drop trigger if exists drafts_set_updated_at on public.dm_drafts;
create trigger drafts_set_updated_at
  before update on public.dm_drafts
  for each row execute function public.set_updated_at();
