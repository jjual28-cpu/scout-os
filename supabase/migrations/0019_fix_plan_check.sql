-- =============================================================================
-- Scout OS — 0019: Fix subscriptions plan check constraint
--
-- 초기 0017 이 'free','pro' 두 값만 허용하는 형태로 먼저 배포된 환경이 있어,
-- 'basic'(베이직) 결제 시 subscriptions_plan_chk 위반으로 활성화가 실패했다.
-- 제약을 drop 후 세 값('free','basic','pro')으로 다시 만든다. 재실행 가능.
-- =============================================================================

alter table public.subscriptions drop constraint if exists subscriptions_plan_chk;
alter table public.subscriptions
  add constraint subscriptions_plan_chk check (plan in ('free', 'basic', 'pro'));
