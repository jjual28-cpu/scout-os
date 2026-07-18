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
