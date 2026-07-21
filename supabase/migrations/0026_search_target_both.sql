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
