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
