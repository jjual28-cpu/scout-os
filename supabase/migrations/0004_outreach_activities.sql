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
