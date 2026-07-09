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
