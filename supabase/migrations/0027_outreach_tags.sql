-- =============================================================================
-- Scout OS — 0027: outreach_activities.tags (per-creator free-form labels)
--
-- 상세 페이지·CRM 카드에서 셀럽을 자유 태그로 분류(예: "뷰티", "10만+", "재컨택",
-- "인플루언서"). 기존 status/stage 와 별개인 다중 라벨. text[] 기본 빈 배열이라
-- 기존 행/코드에 영향 없음(재실행 가능·idempotent).
-- Supabase SQL 편집기에서 실행. 배포 전에 먼저 적용할 것.
-- =============================================================================

alter table public.outreach_activities
  add column if not exists tags text[] not null default '{}';
