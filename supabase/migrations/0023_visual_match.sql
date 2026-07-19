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
