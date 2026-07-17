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
