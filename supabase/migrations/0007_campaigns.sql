-- =============================================================================
-- Scout OS — Campaigns (Session system)
--
-- A Campaign is the unit that ties one keyword search to its result snapshots and,
-- eventually, the whole AI-Engine flow (product → keywords → search → DM → CRM →
-- collab). We RENAME the existing `searches` table to `campaigns` (preserving every
-- row) and extend it, then add `campaign_results` for per-session creator snapshots.
--
-- The Campaign funnel (saved/DM/reply/collab/전환율) is DERIVED at read time by
-- joining campaign_results with saved_opportunities + outreach_activities — never
-- denormalized here. AI-Engine-ready via product_id + source.
--
-- Idempotent + re-runnable. Apply in the Supabase SQL editor.
-- =============================================================================

-- ── Rename searches → campaigns (only once; safe to re-run) ───────────────────
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'searches')
     and not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'campaigns') then
    alter table public.searches rename to campaigns;
  end if;
end $$;

-- Rename the 0005 indexes to match (no-op if already renamed / absent).
alter index if exists public.searches_user_idx  rename to campaigns_user_idx;
alter index if exists public.searches_query_idx rename to campaigns_query_idx;

-- ── Campaign columns (existing rows preserved; title backfilled from query) ───
alter table public.campaigns add column if not exists title      text;
update public.campaigns set title = query where title is null;
alter table public.campaigns alter column title set not null;

alter table public.campaigns add column if not exists status     text not null default 'succeeded'; -- running | succeeded | failed (execution)
alter table public.campaigns add column if not exists error      text;
alter table public.campaigns add column if not exists label      text not null default 'active';    -- active | hold | done | failed (workflow, user-set)
alter table public.campaigns add column if not exists source     text not null default 'manual';    -- manual | ai
alter table public.campaigns add column if not exists memo       text;
alter table public.campaigns add column if not exists brand      text;
alter table public.campaigns add column if not exists season     text;
alter table public.campaigns add column if not exists goal       text;
alter table public.campaigns add column if not exists favorite   boolean not null default false;
alter table public.campaigns add column if not exists product_id uuid references public.products (id) on delete set null;
alter table public.campaigns add column if not exists updated_at timestamptz not null default now();

create index if not exists campaigns_product_idx  on public.campaigns (product_id);
create index if not exists campaigns_favorite_idx on public.campaigns (user_id, favorite, created_at desc);

-- ── RLS — replace 0005's searches_* policies with campaigns_* (select/insert/update/delete) ──
drop policy if exists "searches_select_own"   on public.campaigns;
drop policy if exists "searches_insert_own"   on public.campaigns;
drop policy if exists "campaigns_select_own"  on public.campaigns;
drop policy if exists "campaigns_insert_own"  on public.campaigns;
drop policy if exists "campaigns_update_own"  on public.campaigns;
drop policy if exists "campaigns_delete_own"  on public.campaigns;

create policy "campaigns_select_own" on public.campaigns
  for select using (auth.uid() = user_id);
create policy "campaigns_insert_own" on public.campaigns
  for insert with check (auth.uid() = user_id);
create policy "campaigns_update_own" on public.campaigns
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "campaigns_delete_own" on public.campaigns
  for delete using (auth.uid() = user_id);

-- ── campaign_results: per-campaign creator snapshots ─────────────────────────
create table if not exists public.campaign_results (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  campaign_id      uuid not null references public.campaigns (id) on delete cascade, -- campaign delete → cascade results
  creator_id       text not null,   -- discovered_creators.external_id (e.g. instagram:username)
  platform         text not null default 'instagram',
  rank             integer,
  search_keyword   text,
  creator_snapshot jsonb not null default '{}'::jsonb, -- display data at search time
  created_at       timestamptz not null default now(),
  unique (user_id, campaign_id, creator_id)             -- no duplicate creator per campaign
);

create index if not exists campaign_results_campaign_idx
  on public.campaign_results (user_id, campaign_id, rank);

alter table public.campaign_results enable row level security;

drop policy if exists "campaign_results_select_own" on public.campaign_results;
create policy "campaign_results_select_own" on public.campaign_results
  for select using (auth.uid() = user_id);

drop policy if exists "campaign_results_insert_own" on public.campaign_results;
create policy "campaign_results_insert_own" on public.campaign_results
  for insert with check (auth.uid() = user_id);

drop policy if exists "campaign_results_delete_own" on public.campaign_results;
create policy "campaign_results_delete_own" on public.campaign_results
  for delete using (auth.uid() = user_id);
