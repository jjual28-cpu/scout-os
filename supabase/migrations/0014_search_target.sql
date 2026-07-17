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
