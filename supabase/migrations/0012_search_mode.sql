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
