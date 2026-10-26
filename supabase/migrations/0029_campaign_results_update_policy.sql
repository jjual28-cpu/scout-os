-- =============================================================================
-- Scout OS — 0029: campaign_results 본인 행 UPDATE 정책
--
-- 버그: campaign_results에는 SELECT/INSERT/DELETE 정책만 있고 UPDATE 정책이 없었다.
-- 그래서 status 라우트의 AI 판정 저장(ai_score·ai_verdict·ai_reason·ai_audience)과
-- visual 라우트의 비주얼 판정 저장(visual_*)이 RLS에 막혀 오류 없이 0행만 바뀌었다.
-- (2026-10-26 확인: 942행 전부 ai_verdict NULL → 'AI가 보증한 계정만 기본 노출'이 안 되고
--  주제와 안 맞는 계정까지 그대로 보였으며, 추천 이유·점수가 비어 있었음)
-- 해결: campaigns_update_own과 같은 조건(본인 user_id)으로 UPDATE를 허용한다.
-- 재실행 가능(idempotent).
-- =============================================================================

drop policy if exists "campaign_results_update_own" on public.campaign_results;
create policy "campaign_results_update_own" on public.campaign_results
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
