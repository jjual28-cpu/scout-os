-- =============================================================================
-- Scout OS — discovery_jobs (job queue for the local Scout Worker)
--
-- Scout OS (web) enqueues a job; a local Playwright worker on the user's machine
-- polls pending jobs (via the service-role key, bypassing RLS), scrapes public
-- data, and upserts results into `discovered_creators`. `platform` keeps the
-- queue multi-platform (instagram / threads / tiktok / youtube / naver / ...).
-- Apply in the Supabase SQL editor.
-- =============================================================================

create table if not exists public.discovery_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform     text not null default 'instagram',
  provider     text not null default 'playwright',
  query        text not null,
  status       text not null default 'pending', -- pending | running | succeeded | failed
  result_count integer not null default 0,
  error        text,
  attempts     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

create index if not exists discovery_jobs_pending_idx
  on public.discovery_jobs (status, created_at);
create index if not exists discovery_jobs_user_idx
  on public.discovery_jobs (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- RLS — users see/create their OWN jobs. The worker uses the service-role key,
-- which bypasses RLS, so it can claim and complete any pending job.
-- -----------------------------------------------------------------------------
alter table public.discovery_jobs enable row level security;

drop policy if exists "jobs_select_own" on public.discovery_jobs;
create policy "jobs_select_own" on public.discovery_jobs
  for select using (auth.uid() = user_id);

drop policy if exists "jobs_insert_own" on public.discovery_jobs;
create policy "jobs_insert_own" on public.discovery_jobs
  for insert with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- updated_at trigger (self-contained)
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

drop trigger if exists discovery_jobs_set_updated_at on public.discovery_jobs;
create trigger discovery_jobs_set_updated_at
  before update on public.discovery_jobs
  for each row execute function public.set_updated_at();
