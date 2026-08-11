-- Scout OS 전체 스키마 (마이그레이션 순서대로 통합)
-- Supabase SQL Editor에 통째로 붙여넣고 Run 하세요. 한 번만 실행.


-- ============================================================
-- 00000000000000_rls_policies.sql
-- ============================================================
-- =============================================================================
-- Scout OS — Row Level Security (RLS) policies
--
-- Prisma owns the table SCHEMA (via `prisma migrate`); this migration layers on
-- the tenant-isolation policies that Prisma does not manage. Apply it AFTER the
-- Prisma schema has been pushed, e.g. as part of `supabase db push` or by
-- running it against the database once tables exist.
--
-- Model: a user may only read/write rows in workspaces they are a member of.
-- The service-role key bypasses RLS for trusted server jobs.
-- =============================================================================

-- Helper: workspaces the current auth user belongs to.
create or replace function public.current_user_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select "workspaceId" from public.memberships where "userId" = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS on tenant-scoped tables.
-- ----------------------------------------------------------------------------
alter table public.workspaces      enable row level security;
alter table public.memberships     enable row level security;
alter table public.creators        enable row level security;
alter table public.social_accounts enable row level security;
alter table public.saved_searches  enable row level security;
alter table public.segments        enable row level security;
alter table public.discovery_runs  enable row level security;
alter table public.ai_analyses     enable row level security;
alter table public.campaigns       enable row level security;
alter table public.deals           enable row level security;
alter table public.outreach_messages enable row level security;
alter table public.notes           enable row level security;
alter table public.activities      enable row level security;
alter table public.tags            enable row level security;

-- ----------------------------------------------------------------------------
-- Workspaces & memberships.
-- ----------------------------------------------------------------------------
create policy "members can read their workspaces"
  on public.workspaces for select
  using (id in (select public.current_user_workspace_ids()));

create policy "users can read their memberships"
  on public.memberships for select
  using ("userId" = auth.uid());

-- ----------------------------------------------------------------------------
-- Generic workspace-scoped tables: full access for workspace members.
-- ----------------------------------------------------------------------------
create policy "workspace members full access - creators"
  on public.creators for all
  using ("workspaceId" in (select public.current_user_workspace_ids()))
  with check ("workspaceId" in (select public.current_user_workspace_ids()));

create policy "workspace members full access - saved_searches"
  on public.saved_searches for all
  using ("workspaceId" in (select public.current_user_workspace_ids()))
  with check ("workspaceId" in (select public.current_user_workspace_ids()));

create policy "workspace members full access - segments"
  on public.segments for all
  using ("workspaceId" in (select public.current_user_workspace_ids()))
  with check ("workspaceId" in (select public.current_user_workspace_ids()));

create policy "workspace members full access - discovery_runs"
  on public.discovery_runs for all
  using ("workspaceId" in (select public.current_user_workspace_ids()))
  with check ("workspaceId" in (select public.current_user_workspace_ids()));

create policy "workspace members full access - campaigns"
  on public.campaigns for all
  using ("workspaceId" in (select public.current_user_workspace_ids()))
  with check ("workspaceId" in (select public.current_user_workspace_ids()));

create policy "workspace members full access - deals"
  on public.deals for all
  using ("workspaceId" in (select public.current_user_workspace_ids()))
  with check ("workspaceId" in (select public.current_user_workspace_ids()));

create policy "workspace members full access - tags"
  on public.tags for all
  using ("workspaceId" in (select public.current_user_workspace_ids()))
  with check ("workspaceId" in (select public.current_user_workspace_ids()));

-- ----------------------------------------------------------------------------
-- Child tables: authorised via their parent's workspace.
-- ----------------------------------------------------------------------------
create policy "access social_accounts via creator"
  on public.social_accounts for all
  using (
    exists (
      select 1 from public.creators c
      where c.id = social_accounts."creatorId"
        and c."workspaceId" in (select public.current_user_workspace_ids())
    )
  );

create policy "access ai_analyses via creator"
  on public.ai_analyses for all
  using (
    exists (
      select 1 from public.creators c
      where c.id = ai_analyses."creatorId"
        and c."workspaceId" in (select public.current_user_workspace_ids())
    )
  );

create policy "access outreach_messages via deal"
  on public.outreach_messages for all
  using (
    exists (
      select 1 from public.deals d
      where d.id = outreach_messages."dealId"
        and d."workspaceId" in (select public.current_user_workspace_ids())
    )
  );

create policy "access activities via deal"
  on public.activities for all
  using (
    "dealId" is null or exists (
      select 1 from public.deals d
      where d.id = activities."dealId"
        and d."workspaceId" in (select public.current_user_workspace_ids())
    )
  );

create policy "access notes via creator or deal"
  on public.notes for all
  using (
    (
      "creatorId" is not null and exists (
        select 1 from public.creators c
        where c.id = notes."creatorId"
          and c."workspaceId" in (select public.current_user_workspace_ids())
      )
    )
    or (
      "dealId" is not null and exists (
        select 1 from public.deals d
        where d.id = notes."dealId"
          and d."workspaceId" in (select public.current_user_workspace_ids())
      )
    )
  );


-- ============================================================
-- 0001_mvp_user_data.sql
-- ============================================================
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


-- ============================================================
-- 0002_discovered_creators.sql
-- ============================================================
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


-- ============================================================
-- 0003_discovery_jobs.sql
-- ============================================================
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


-- ============================================================
-- 0004_outreach_activities.sql
-- ============================================================
-- =============================================================================
-- Scout OS — outreach_activities (per-creator contact & follow-up history)
--
-- The activity record for the "발굴 → 연락 → 후속관리" flow. One row per
-- (user, creator). `creator_id` is the discovered_creators.external_id string
-- (e.g. "instagram:username"), the same id the /discover cards and
-- /creators/[id] route use — so it stays stable across the app.
--
-- Separation of concerns (unchanged elsewhere):
--   discovered_creators  → raw collected creators (source, keeps raw_data)
--   saved_opportunities  → save / classify list
--   dm_drafts            → DM draft content (by opportunity id)
--   outreach_activities  → THIS: contact status, DM, follow-up, replies
-- Apply in the Supabase SQL editor.
-- =============================================================================

create table if not exists public.outreach_activities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creator_id    text not null, -- discovered_creators.external_id (e.g. instagram:username)
  status        text not null default '미검토', -- 미검토|관심|보류|제외|연락예정|연락완료|답변옴
  note          text,
  dm_draft      text,
  contacted_at  timestamptz,
  follow_up_at  date,
  reply_status  text,          -- e.g. '답변옴' | '무응답' | null
  reply_note    text,
  contact_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, creator_id)
);

create index if not exists outreach_activities_user_idx
  on public.outreach_activities (user_id, updated_at desc);
create index if not exists outreach_activities_followup_idx
  on public.outreach_activities (user_id, follow_up_at);

-- -----------------------------------------------------------------------------
-- Row Level Security — a user may only read/write their OWN rows
-- -----------------------------------------------------------------------------
alter table public.outreach_activities enable row level security;

drop policy if exists "outreach_select_own" on public.outreach_activities;
create policy "outreach_select_own" on public.outreach_activities
  for select using (auth.uid() = user_id);

drop policy if exists "outreach_insert_own" on public.outreach_activities;
create policy "outreach_insert_own" on public.outreach_activities
  for insert with check (auth.uid() = user_id);

drop policy if exists "outreach_update_own" on public.outreach_activities;
create policy "outreach_update_own" on public.outreach_activities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "outreach_delete_own" on public.outreach_activities;
create policy "outreach_delete_own" on public.outreach_activities
  for delete using (auth.uid() = user_id);

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

drop trigger if exists outreach_activities_set_updated_at on public.outreach_activities;
create trigger outreach_activities_set_updated_at
  before update on public.outreach_activities
  for each row execute function public.set_updated_at();


-- ============================================================
-- 0005_searches.sql
-- ============================================================
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


-- ============================================================
-- 0006_products.sql
-- ============================================================
-- =============================================================================
-- Scout OS — products (brand product catalog for AI-driven creator matching)
--
-- The brand's products. AI Engine (next feature) will read these to recommend
-- keywords + creators. One row per product, RLS-scoped to the owning user.
-- Apply in the Supabase SQL editor.
-- =============================================================================

create table if not exists public.products (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_code          text,                   -- AI Engine 참조용 코드 (예: VNT001)
  is_active             boolean not null default true, -- 검색/AI 대상 여부
  name                  text not null,          -- 상품
  brand                 text,                   -- 브랜드
  category              text,                   -- 카테고리
  image_url             text,                   -- 대표 이미지 URL
  status                text not null default '준비중', -- 판매중 | 준비중 | 품절 | 중지
  -- collab_type stores one or more of 제품제공/수익쉐어/게런티/협의 (comma-separated)
  price                 numeric,                -- 판매가
  commission            numeric,                -- 수수료(%)
  revenue_share_pct     numeric,                -- 기본 수익쉐어율(%)
  collab_type           text,                   -- 제품제공 | 수익쉐어 | 게런티 | 협의
  usp                   text,                   -- USP
  selling_points        text,                   -- 판매 포인트
  banned_phrases        text,                   -- 금지 문구
  collab_terms          text,                   -- 협업 조건
  target                text,                   -- 추천 타겟
  recommended_keywords  text,                   -- 추천 키워드 (AI Engine 사용, 쉼표 구분)
  analysis              text,                   -- AI 상품 분석 결과 (다음 단계 AI Engine이 채움)
  analysis_source       text,                   -- 분석 출처 (예: rule | openai)
  analysis_updated_at   timestamptz,            -- AI 분석 시각
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists products_user_idx on public.products (user_id, updated_at desc);
-- product_code unique per user (nulls allowed)
create unique index if not exists products_code_uniq
  on public.products (user_id, product_code) where product_code is not null;

-- -----------------------------------------------------------------------------
-- Row Level Security — a user may only read/write their OWN products
-- -----------------------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "products_select_own" on public.products;
create policy "products_select_own" on public.products
  for select using (auth.uid() = user_id);

drop policy if exists "products_insert_own" on public.products;
create policy "products_insert_own" on public.products
  for insert with check (auth.uid() = user_id);

drop policy if exists "products_update_own" on public.products;
create policy "products_update_own" on public.products
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "products_delete_own" on public.products;
create policy "products_delete_own" on public.products
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- updated_at trigger (reuses the shared set_updated_at function)
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

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();


-- ============================================================
-- 0007_campaigns.sql
-- ============================================================
-- =============================================================================
-- Scout OS — Campaigns (Session system)
--
-- A Campaign ties one keyword search to its result snapshots and, eventually, the
-- whole AI-Engine flow (product → keywords → search → DM → CRM → collab).
--
-- IMPORTANT — this migration is self-sufficient and does NOT require 0005_searches.
-- On some databases `searches` (0005) was never applied, so we cannot rely on
-- renaming it. This script:
--   • renames `searches` → `campaigns` when `searches` exists (preserving its rows),
--   • otherwise CREATES `campaigns` fresh,
--   • leaves an existing `campaigns` untouched (only adds any missing columns),
-- then extends it and adds `campaign_results`. Existing tables are never dropped.
--
-- The Campaign funnel (saved/DM/reply/collab/전환율) is DERIVED at read time by
-- joining campaign_results with saved_opportunities + outreach_activities — never
-- denormalized here. AI-Engine-ready via product_id + source.
--
-- Fully idempotent + re-runnable. Apply in the Supabase SQL editor.
-- =============================================================================

-- ── Ensure a `campaigns` base table exists (rename searches, or create fresh) ──
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'searches')
     and not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'campaigns') then
    -- 0005 was applied here → preserve its rows by renaming.
    alter table public.searches rename to campaigns;
  elsif not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'campaigns') then
    -- Fresh install (0005 never applied) → create the base table directly.
    create table public.campaigns (
      id           uuid primary key default gen_random_uuid(),
      user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
      query        text not null,
      platform     text not null default 'instagram',
      result_count integer not null default 0,
      created_at   timestamptz not null default now()
    );
  end if;
end $$;

-- Rename 0005's indexes if they came across from `searches`; ensure they exist either way.
alter index if exists public.searches_user_idx  rename to campaigns_user_idx;
alter index if exists public.searches_query_idx rename to campaigns_query_idx;
create index if not exists campaigns_user_idx  on public.campaigns (user_id, created_at desc);
create index if not exists campaigns_query_idx on public.campaigns (lower(query));

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

-- ── RLS — enable + own-row policies (works for renamed or freshly-created) ────
alter table public.campaigns enable row level security;

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


-- ============================================================
-- 0008_campaign_async_runs.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0008: Campaign async Apify runs
--
-- 동기 실행 → 비동기(Run Actor + 폴링 상태머신) 전환용
-- 최소 컬럼/인덱스. 새 테이블 없음. 행/campaign_results 삭제 없음.
-- Apify 파이프라인이 3단계(user → posts → details) 조건부이므로 apify_stage 보존.
-- query 는 사용자 입력 원문을 그대로 저장하고, 비교(캐시/running/중복)는 전부
-- 생성 컬럼 query_norm 기준으로 통일한다. 전 구간 재실행 가능(idempotent).
-- Apply in the Supabase SQL editor.
-- =============================================================================

-- ── 1) 비동기 run 부기 컬럼 ──────────────────────────────────────────────────
alter table public.campaigns add column if not exists apify_run_id     text;        -- 현재 대기 중인 run id
alter table public.campaigns add column if not exists apify_dataset_id text;        -- 그 run의 defaultDatasetId
alter table public.campaigns add column if not exists apify_stage      smallint;    -- 1=user, 2=posts, 3=details
alter table public.campaigns add column if not exists started_at       timestamptz; -- 검색 시작
alter table public.campaigns add column if not exists completed_at     timestamptz; -- 결과 저장 완료(또는 실패 확정)

-- ── 2) 비교 전용 정규화 컬럼 (query 원문은 그대로 보존, DB가 자동 계산) ──────
--     trim + 연속 공백 1칸 + lowercase. 앱의 normalizeQuery()와 동일 규칙.
--     기존 행도 추가 시점에 자동 채워진다(앱이 백필할 필요 없음).
alter table public.campaigns
  add column if not exists query_norm text
  generated always as (lower(btrim(regexp_replace(query, '\s+', ' ', 'g')))) stored;

-- ── 3) apify_stage 값 제약 (null 또는 1~3) — idempotent ──────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.campaigns'::regclass
       and conname  = 'campaigns_apify_stage_chk'
  ) then
    alter table public.campaigns
      add constraint campaigns_apify_stage_chk
      check (apify_stage is null or apify_stage between 1 and 3);
  end if;
end $$;

-- ── 4) 기존 running 보정: started_at 채우기 ──────────────────────────────────
update public.campaigns
   set started_at = created_at
 where status = 'running'
   and started_at is null;

-- ── 5) 고아 running 정리 (구 동기 방식 잔여물: 재개할 run이 없음) ─────────────
--     ⚠ 행/결과 보존, status/error/completed_at만 갱신.
update public.campaigns
   set status       = 'failed',
       error        = coalesce(error, '이전 동기 검색이 완료되지 않았습니다. 다시 검색해 주세요.'),
       completed_at = coalesce(completed_at, now())
 where status = 'running'
   and apify_run_id is null;

-- ── 6) 중복 running 정리 (unique 인덱스 생성 전제) ───────────────────────────
--     같은 user_id + platform + query_norm 의 running 중 최신 1건만 유지.
--     ⚠ 행/결과 보존, status/error/completed_at만 갱신.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, platform, query_norm
           order by coalesce(started_at, created_at) desc, created_at desc, id desc
         ) as rn
    from public.campaigns
   where status = 'running'
)
update public.campaigns c
   set status       = 'failed',
       error        = '중복 실행 Campaign이 정리되었습니다.',
       completed_at = now()
  from ranked r
 where c.id = r.id
   and r.rn > 1;

-- ── 7) 24시간 캐시 조회 인덱스 ───────────────────────────────────────────────
create index if not exists campaigns_cache_idx
  on public.campaigns (user_id, platform, query_norm, created_at desc)
  where status = 'succeeded';

-- ── 8) 동일 검색 running 1건 강제 (running 조회 인덱스 겸용) ─────────────────
--     동시 요청의 unique violation은 앱에서 "기존 running 재조회 → campaignId 반환"
--     으로 처리한다(Actor 추가 실행 없음).
create unique index if not exists campaigns_one_running_uniq
  on public.campaigns (user_id, platform, query_norm)
  where status = 'running';


-- ============================================================
-- 0010_ai_usage.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0010: Per-user daily AI usage cap (shared platform key)
--
-- AI 는 Scout OS 대표 OpenRouter 키(운영자 충전) 하나로 동작한다. 폭주로 인한
-- 비용 사고를 막기 위해 사용자마다 "하루 N회" 상한을 둔다. 상한값은 앱의
-- AI_DAILY_LIMIT 환경변수에서 넘어온다(코드/DB 어디에도 하드코딩하지 않음).
--
-- 재실행 가능(idempotent). 기존 테이블 변경/삭제 없음.
-- =============================================================================

create table if not exists public.ai_usage (
  user_id    uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,               -- Asia/Seoul 기준 날짜
  calls      int  not null default 0,
  primary key (user_id, usage_date)
);

alter table public.ai_usage enable row level security;

-- 사용자는 본인 사용량만 조회 (설정 페이지의 "오늘 X/N회" 표시용)
drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select to authenticated using (auth.uid() = user_id);
-- 쓰기 정책 없음 → 브라우저는 카운트를 조작할 수 없다. 증가는 아래 함수로만.

-- ── 원자적 증가 + 상한 검사 (service_role 전용) ──────────────────────────────
--     반환값: 증가 후 오늘 호출 수. 상한 초과로 증가하지 못하면 -1.
create or replace function public.bump_ai_usage(p_user uuid, p_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_calls int;
begin
  insert into public.ai_usage (user_id, usage_date, calls)
       values (p_user, v_today, 1)
  on conflict (user_id, usage_date) do update
       set calls = public.ai_usage.calls + 1
       where public.ai_usage.calls < p_limit
  returning calls into v_calls;

  return coalesce(v_calls, -1); -- null ⇒ 상한 초과로 갱신 안 됨
end $$;

revoke all on function public.bump_ai_usage(uuid, int) from public;
grant execute on function public.bump_ai_usage(uuid, int) to service_role;


-- ============================================================
-- 0011_ai_match.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0011: AI creator matching verdicts
--
-- Apify 는 넓게 긁어오기만 한다(원재료). 그 결과를 AI 가 읽고 "이 브랜드/검색
-- 의도에 진짜 맞는 셀럽인지" 판정한 값을 여기 저장한다. 화면은 이 값으로
-- 정보성·무관 계정을 걸러내고 적합도 순으로 보여준다.
--
-- 판정은 검색 결과에 종속되므로 campaign_results 에 컬럼으로 붙인다.
-- 기존 행/컬럼 변경·삭제 없음. 전 구간 재실행 가능(idempotent).
-- Apply in the Supabase SQL editor.
-- =============================================================================

-- ai_score: 0~100 적합도. null = 아직 판정 안 함(AI 미실행/실패).
alter table public.campaign_results add column if not exists ai_score smallint;

-- ai_verdict: 'fit' | 'maybe' | 'reject'. null = 미판정.
--   fit    = 추천 (기본 노출)
--   maybe  = 애매 (노출하되 하위)
--   reject = 정보성/무관 계정 (기본 숨김)
alter table public.campaign_results add column if not exists ai_verdict text;

-- ai_reason: AI 가 그렇게 판단한 한 줄 근거 (카드에 표시).
alter table public.campaign_results add column if not exists ai_reason text;

-- 값 제약 (null 허용) — idempotent
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.campaign_results'::regclass
       and conname  = 'campaign_results_ai_verdict_chk'
  ) then
    alter table public.campaign_results
      add constraint campaign_results_ai_verdict_chk
      check (ai_verdict is null or ai_verdict in ('fit', 'maybe', 'reject'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.campaign_results'::regclass
       and conname  = 'campaign_results_ai_score_chk'
  ) then
    alter table public.campaign_results
      add constraint campaign_results_ai_score_chk
      check (ai_score is null or ai_score between 0 and 100);
  end if;
end $$;

-- 적합도 순 정렬용 인덱스 (캠페인별 조회가 항상 user_id + campaign_id 기준)
create index if not exists campaign_results_ai_rank_idx
  on public.campaign_results (user_id, campaign_id, ai_score desc nulls last);


-- ============================================================
-- 0012_search_mode.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0012: Search mode (keyword | tagged)
--
-- 셀럽 발굴 입구를 두 개로 나눈다.
--   keyword — 이름/해시태그 검색 (기존). query = 검색어
--   tagged  — 특정 브랜드를 "태그한" 계정 수집. query = 그 브랜드 핸들
--             (이미 브랜드 협업을 하고 있다는 증거라 신호가 훨씬 강하다)
--
-- 단계 수는 늘리지 않는다. 같은 3단계 상태머신을 모드별로 다르게 해석한다:
--   keyword: 1=이름검색 → 2=해시태그 게시물→작성자 → 3=프로필 채우기
--   tagged : 1=태그 게시물→작성자 → 2=프로필 채우기 → (끝)
--
-- query 는 원문 그대로 저장되고 query_norm/캐시/중복 방지가 그대로 동작한다.
-- 기존 행은 전부 'keyword' 로 채워진다. 재실행 가능(idempotent).
-- =============================================================================

alter table public.campaigns
  add column if not exists search_mode text not null default 'keyword';

-- 값 제약 — idempotent
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.campaigns'::regclass
       and conname  = 'campaigns_search_mode_chk'
  ) then
    alter table public.campaigns
      add constraint campaigns_search_mode_chk
      check (search_mode in ('keyword', 'tagged'));
  end if;
end $$;

-- 상품에 "경쟁 브랜드 계정"을 저장해 두면 그 상품으로 검색할 때 자동으로 쓴다.
-- 쉼표 구분 핸들 목록 (예: "brand_a, brand_b").
alter table public.products
  add column if not exists competitor_handles text;


-- ============================================================
-- 0013_search_plan.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0013: AI search plan (natural language → Instagram terms)
--
-- 사용자는 AI 에게 말하듯 검색한다: "신생 바디케어 브랜드 찾아줘".
-- 인스타는 계정 이름과 해시태그만 이해하므로 그대로 넣으면 0건이 나온다.
-- AI 가 이를 번역한 결과(검색어 / 실제 해시태그 / 의도)를 여기 저장한다.
--
-- 계획은 검색 시작 시 1회 만들어지고, 2단계(해시태그 수집)와 AI 적합도 판정이
-- 이 값을 다시 읽는다. 따라서 캠페인에 저장해야 한다(재시도·복원에도 유지).
--
-- query 는 사용자가 친 원문 그대로 보존된다. 계획은 별도 컬럼이다.
-- 기존 행/컬럼 변경 없음. 재실행 가능(idempotent).
-- =============================================================================

-- { searchTerm: string, hashtags: string[], intent: string }
-- null = AI 번역을 쓰지 않은 검색(단순 키워드) 또는 AI 실패 → 원문으로 검색.
alter table public.campaigns add column if not exists search_plan jsonb;


-- ============================================================
-- 0014_search_target.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0014: Search target (creator | brand)
--
-- 같은 검색어라도 사용자가 찾는 대상이 정반대다.
--   creator — 협업 제안할 셀럽 (브랜드 공식 계정은 reject)
--   brand   — 브랜드/제품 공식 계정 (개인 크리에이터는 reject)
-- 목적을 안 고르면 AI가 사용자가 원하는 걸 정확히 버린다.
--
-- 검색 시작 시 저장되고, AI 적합도 판정이 이 값을 다시 읽는다(재시도에도 유지).
-- 기존 행은 전부 'creator'. 재실행 가능(idempotent).
-- =============================================================================

alter table public.campaigns
  add column if not exists search_target text not null default 'creator';

-- 값 제약 — idempotent
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.campaigns'::regclass
       and conname  = 'campaigns_search_target_chk'
  ) then
    alter table public.campaigns
      add constraint campaigns_search_target_chk
      check (search_target in ('creator', 'brand'));
  end if;
end $$;

-- ── 캐시/중복 방지 키에 target·mode 추가 ────────────────────────────────────
--
-- 0008 의 두 인덱스는 query_norm 만 봤다. 목적이 생기면서 그게 틀렸다:
-- "바디케어"를 셀럽으로 찾은 뒤 브랜드로 다시 찾으면 24h 캐시가 셀럽 결과를
-- 그대로 돌려주고(정반대 결과), running 중이면 unique violation 으로 검색이
-- 아예 실패한다. mode(keyword/tagged) 도 같은 이유로 이미 충돌하고 있었다.
--
-- 같은 검색어라도 "무엇을 어떻게 찾는가"가 다르면 다른 검색이다.

drop index if exists public.campaigns_cache_idx;
create index if not exists campaigns_cache_idx
  on public.campaigns (user_id, platform, query_norm, search_target, search_mode, created_at desc)
  where status = 'succeeded';

drop index if exists public.campaigns_one_running_uniq;
create unique index if not exists campaigns_one_running_uniq
  on public.campaigns (user_id, platform, query_norm, search_target, search_mode)
  where status = 'running';


-- ============================================================
-- 0015_campaign_ai_error.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0015: Surface AI failures instead of swallowing them
--
-- AI 판정/검색어 변환은 best-effort 라 실패해도 검색은 성공한다. 문제는 실패가
-- 조용히 넘어가서, AI 키가 죽었을 때 아무도 모른 채 "검색이 0명"만 보였다는 것.
-- (실제로 이것 때문에 몇 시간 헤맸다.) 실패 사유를 캠페인에 남겨 화면에 띄운다.
--
-- null = AI 정상(또는 애초에 AI 를 쓰지 않은 검색). 텍스트 = 사용자에게 보일 사유.
-- 기존 행/컬럼 변경 없음. 재실행 가능(idempotent).
-- =============================================================================

alter table public.campaigns
  add column if not exists ai_error text;


-- ============================================================
-- 0016_creator_pool.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0016: Global creator pool (Apify cost reduction)
--
-- Every search that enriches author usernames pays Apify again, even for a
-- creator someone already scraped minutes ago. This is a shared, cross-user
-- cache of enriched Instagram profiles: scrape a creator once, reuse it.
--
-- Public IG profile data → sharing across users is fine. Only the service_role
-- (server) reads/writes it, so RLS is ON with NO policies (deny for anon;
-- service_role bypasses RLS). Freshness is enforced in code (default 3 days),
-- and trending("요즘 뜨는") searches bypass the pool so recency stays live.
--
-- 재실행 가능(idempotent).
-- =============================================================================

create table if not exists public.creator_pool (
  platform         text not null,
  username         text not null,
  snapshot         jsonb not null,          -- normalized InstagramCreator (no rawData)
  followers_count  integer,
  scraped_at       timestamptz not null default now(),
  primary key (platform, username)
);

create index if not exists creator_pool_scraped_idx
  on public.creator_pool (platform, scraped_at desc);

alter table public.creator_pool enable row level security;
-- No policies on purpose: only service_role (server) touches this table.


-- ============================================================
-- 0017_subscriptions.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0017: Subscriptions (plan model)
--
-- 1단계: 플랜/구독 모델 + 설정 화면 표시용. 아직 실제 결제도, 검색 차단도 없다.
--   free   — 월 1회 (맛보기)
--   basic  — 월 100회 (19,800원/월)
--   pro    — 월 300회 (29,800원/월)
-- 실제 결제(토스 정기결제)와 검색 차단은 2단계에서 켠다.
--
-- 구독 행이 없으면 free 로 취급(코드 기본값). 쓰기는 서버(service_role)만.
-- 오너 계정은 배포 후 수동으로 pro 로 올린다(아래 주석 참고). 재실행 가능.
-- =============================================================================

create table if not exists public.subscriptions (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  plan                 text not null default 'free',
  status               text not null default 'active',
  billing_cycle        text,               -- 'monthly' | 'yearly' | null (2단계)
  current_period_end   timestamptz,
  provider             text,               -- 'toss' (2단계)
  provider_billing_key text,               -- 정기결제 키 (2단계)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint subscriptions_plan_chk check (plan in ('free', 'basic', 'pro'))
);

alter table public.subscriptions enable row level security;

-- 본인 구독만 조회. 쓰기 정책 없음 → service_role(서버)만 수정.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'subscriptions'
       and policyname = 'subscriptions_self_read'
  ) then
    create policy subscriptions_self_read on public.subscriptions
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- 배포 후 오너를 pro 로 올리는 예시 (user_id 를 본인 것으로 바꿔 실행):
--   insert into public.subscriptions (user_id, plan) values ('<OWNER_USER_ID>', 'pro')
--   on conflict (user_id) do update set plan = 'pro', updated_at = now();


-- ============================================================
-- 0018_billing.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0018: Billing (Toss 정기결제) — phase 2
--
-- 구독을 실제 결제로 잇는다. subscriptions 에 토스 빌링 식별자와 해지예약 플래그를
-- 추가하고, 청구 이력(payments)을 남긴다(영수증·정산·문의·환불 대비).
--
-- 결제/청구는 서버(service_role)만 수행하므로 payments 는 RLS on + 본인 조회만.
-- 재실행 가능(idempotent).
-- =============================================================================

alter table public.subscriptions
  add column if not exists customer_key text,          -- 토스 customerKey (=user_id 기반)
  add column if not exists cancel_at_period_end boolean not null default false;

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  plan          text not null,
  amount        integer not null,          -- 청구 금액(원)
  billing_cycle text,                       -- monthly | yearly
  status        text not null,             -- 'paid' | 'failed'
  provider      text not null default 'toss',
  order_id      text,                       -- 토스 orderId
  payment_key   text,                       -- 토스 paymentKey
  raw           jsonb,                      -- 토스 응답 원본(감사용)
  created_at    timestamptz not null default now()
);

create index if not exists payments_user_idx on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'payments'
       and policyname = 'payments_self_read'
  ) then
    create policy payments_self_read on public.payments
      for select using (auth.uid() = user_id);
  end if;
end $$;


-- ============================================================
-- 0019_fix_plan_check.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0019: Fix subscriptions plan check constraint
--
-- 초기 0017 이 'free','pro' 두 값만 허용하는 형태로 먼저 배포된 환경이 있어,
-- 'basic'(베이직) 결제 시 subscriptions_plan_chk 위반으로 활성화가 실패했다.
-- 제약을 drop 후 세 값('free','basic','pro')으로 다시 만든다. 재실행 가능.
-- =============================================================================

alter table public.subscriptions drop constraint if exists subscriptions_plan_chk;
alter table public.subscriptions
  add constraint subscriptions_plan_chk check (plan in ('free', 'basic', 'pro'));


-- ============================================================
-- 0020_cafe24_import.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0020: 카페24 상품 임포트 (OAuth 연동 + 출처 표시)
--
-- 브랜드가 자기 카페24 몰을 OAuth로 연동하고, 상품을 골라 Scout OS products 로
-- 끌어온다. 액세스/리프레시 토큰은 민감정보이므로 이 테이블은 service_role 만
-- 읽고 쓴다 — self SELECT 정책을 만들지 않아 클라이언트(anon/authenticated)는
-- 토큰에 접근할 수 없다. 연동 여부/mall_id 는 서버 라우트가 admin 으로 조회해
-- 필요한 필드만 내려준다.
--
-- 재실행 가능(idempotent).
-- =============================================================================

create table if not exists public.cafe24_connections (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  mall_id                   text not null,               -- 카페24 몰 ID (subdomain)
  access_token              text not null,               -- 2시간 만료
  refresh_token             text not null,               -- 약 2주 만료
  expires_at                timestamptz not null,        -- access_token 만료 시각
  refresh_token_expires_at  timestamptz,                 -- refresh_token 만료 시각
  scopes                    text,                        -- 발급된 scope (예: mall.read_product)
  connected_at              timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- RLS on, 정책 없음 = anon/authenticated 접근 전면 차단. service_role 만 접근.
alter table public.cafe24_connections enable row level security;

drop trigger if exists cafe24_conn_set_updated_at on public.cafe24_connections;
create trigger cafe24_conn_set_updated_at
  before update on public.cafe24_connections
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 중복 임포트 방지: products 에 출처(source) + 원본 상품번호를 남긴다.
-- 같은 카페24 상품을 두 번 임포트하지 않도록 (user_id, source, source_product_no)
-- 유니크. 손으로 만든 상품(source is null)은 제약 대상 아님.
-- -----------------------------------------------------------------------------
alter table public.products
  add column if not exists source            text,       -- 'cafe24' 등
  add column if not exists source_product_no text;       -- 카페24 product_no

create unique index if not exists products_source_uniq
  on public.products (user_id, source, source_product_no)
  where source is not null and source_product_no is not null;


-- ============================================================
-- 0021_dm_template.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0021: 사용자별 DM 스타일 템플릿
--
-- 각 사용자가 자기 브랜드 스타일의 DM 템플릿을 저장한다. 고정 문구 + 변수
-- ({셀럽}/{상품}/{브랜드}) + AI 구간([[ai: 지시]])을 담은 자유 텍스트 1개.
-- profiles(사용자당 1행, RLS 기존 정책 그대로)에 컬럼만 추가. 재실행 가능.
-- =============================================================================

alter table public.profiles
  add column if not exists dm_template text;


-- ============================================================
-- 0022_instagram_inbox.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0022: 인스타 답장 어드민 수집 (Messaging API + 웹훅)
--
-- 셀럽이 답장하면 Meta 웹훅이 우리 서버로 push → 여기 저장 → 어드민 인박스에서
-- 확인·AI답장·발송. 토큰은 민감정보라 service_role 만(정책 없음 = 클라 차단).
-- 메시지는 본인 것만 조회(self_read) + 읽음 처리(self_update); insert/발신 기록은
-- 서버(웹훅/발송 라우트, service_role). 재실행 가능(idempotent).
-- =============================================================================

-- 인스타 연동 (사용자당 프로 계정 1개). 토큰 서버 전용.
create table if not exists public.instagram_connections (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  ig_user_id          text not null,               -- 프로 계정 Instagram-scoped id (웹훅 recipient 매핑)
  username            text,
  access_token        text not null,               -- long-lived
  token_expires_at    timestamptz,
  connected_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists ig_conn_iguser_idx on public.instagram_connections (ig_user_id);

alter table public.instagram_connections enable row level security; -- 정책 없음 = 클라 차단

drop trigger if exists ig_conn_set_updated_at on public.instagram_connections;
create trigger ig_conn_set_updated_at
  before update on public.instagram_connections
  for each row execute function public.set_updated_at();

-- 대화 메시지 (수신/발신).
create table if not exists public.instagram_messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  peer_id       text not null,                     -- 상대(셀럽) IGSID
  peer_username text,                              -- 알 수 있으면
  direction     text not null,                     -- 'in' | 'out'
  text          text,
  mid           text,                              -- 인스타 message id (중복 방지)
  is_read       boolean not null default false,    -- 어드민 읽음 처리
  created_at    timestamptz not null default now()
);
create index if not exists ig_msg_thread_idx on public.instagram_messages (user_id, peer_id, created_at);
create unique index if not exists ig_msg_mid_uniq on public.instagram_messages (mid) where mid is not null;

alter table public.instagram_messages enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'instagram_messages'
       and policyname = 'ig_msg_self_read'
  ) then
    create policy ig_msg_self_read on public.instagram_messages
      for select using (auth.uid() = user_id);
  end if;

  -- 읽음 처리(update)만 본인 허용. insert/발신 기록은 서버(service_role).
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'instagram_messages'
       and policyname = 'ig_msg_self_update'
  ) then
    create policy ig_msg_self_update on public.instagram_messages
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;


-- ============================================================
-- 0023_visual_match.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0023: 비주얼(이미지) AI 셀럽 판정
--
-- 옵션 기능: 오너가 켜면 셀럽의 프로필·게시물 사진을 비전 AI가 보고, 오너가 지정한
-- 제품 관련 시각 기준(예: 머리 길고 윤기나는 여성)에 얼마나 맞는지 판정한다.
-- 결과를 campaign_results 에 남긴다(본인 RLS update로 저장). 재실행 가능.
-- =============================================================================

alter table public.campaign_results
  add column if not exists visual_score   integer,   -- 0~100
  add column if not exists visual_verdict text,       -- fit | maybe | reject
  add column if not exists visual_reason  text;       -- 한 줄 근거


-- ============================================================
-- 0024_ai_audience.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0024: AI 추정 오디언스
--
-- AI 적합도 판정(같은 호출)에서 각 셀럽의 주 시청자층을 함께 추정해 남긴다.
-- "측정" 데이터가 아니라 소개글·콘텐츠 기반 AI 추정임(화면에도 '추정'으로 표시).
-- 추가 AI 비용 없음(기존 매칭 호출에 필드만 추가). 재실행 가능.
-- =============================================================================

alter table public.campaign_results
  add column if not exists ai_audience text;   -- 예: "20~30대 여성·뷰티" (AI 추정)


-- ============================================================
-- 0025_search_target_gonggu.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0025: 검색 목적에 '공구전문(gonggu)' 추가
--
-- 기존 search_target CHECK 제약이 ('creator','brand')만 허용해서, 공동구매 셀러를
-- 찾는 세 번째 목적('gonggu')을 쓰려면 제약을 넓혀야 한다. 재실행 가능.
-- =============================================================================

alter table public.campaigns
  drop constraint if exists campaigns_search_target_chk;

alter table public.campaigns
  add constraint campaigns_search_target_chk
  check (search_target in ('creator', 'brand', 'gonggu'));


-- ============================================================
-- 0026_search_target_both.sql
-- ============================================================
-- =============================================================================
-- Scout OS — 0026: 검색 목적에 '셀럽+공구 함께(both)' 추가
--
-- AI 직원(상품으로 찾기)은 협업할 콘텐츠 셀럽과 공동구매로 팔아줄 공구 셀러를
-- 함께 찾는 게 유리해, 두 대상을 모두 fit 으로 보는 'both' 목적을 추가한다.
-- 재실행 가능.
-- =============================================================================

alter table public.campaigns
  drop constraint if exists campaigns_search_target_chk;

alter table public.campaigns
  add constraint campaigns_search_target_chk
  check (search_target in ('creator', 'brand', 'gonggu', 'both'));

