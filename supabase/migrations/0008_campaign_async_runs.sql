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
