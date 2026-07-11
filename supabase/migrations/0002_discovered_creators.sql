-- =============================================================================
-- Scout OS — discovered_creators (real Instagram creators fetched via Apify)
--
-- Stores normalized public-profile data per user. RLS-protected so each user
-- only sees their own discovered creators. Apply in the Supabase SQL editor.
-- =============================================================================

create table if not exists public.discovered_creators (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform          text not null default 'instagram',
  external_id       text not null,
  username          text not null,
  display_name      text,
  profile_url       text not null,
  profile_image_url text,
  biography         text,
  followers_count   integer,
  following_count   integer,
  posts_count       integer,
  is_verified       boolean not null default false,
  category          text,
  raw_data          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, platform, external_id)
);

create index if not exists discovered_creators_user_idx
  on public.discovered_creators (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Row Level Security — a user may only read/write their OWN rows
-- -----------------------------------------------------------------------------
alter table public.discovered_creators enable row level security;

drop policy if exists "discovered_select_own" on public.discovered_creators;
create policy "discovered_select_own" on public.discovered_creators
  for select using (auth.uid() = user_id);

drop policy if exists "discovered_insert_own" on public.discovered_creators;
create policy "discovered_insert_own" on public.discovered_creators
  for insert with check (auth.uid() = user_id);

drop policy if exists "discovered_update_own" on public.discovered_creators;
create policy "discovered_update_own" on public.discovered_creators
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "discovered_delete_own" on public.discovered_creators;
create policy "discovered_delete_own" on public.discovered_creators
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Keep updated_at fresh (self-contained: safe to run even without migration 1)
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

drop trigger if exists discovered_creators_set_updated_at on public.discovered_creators;
create trigger discovered_creators_set_updated_at
  before update on public.discovered_creators
  for each row execute function public.set_updated_at();
