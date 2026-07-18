-- =============================================================================
-- Scout OS — 0017: Subscriptions (plan model)
--
-- 1단계: 플랜/구독 모델 + 설정 화면 표시용. 아직 실제 결제도, 검색 차단도 없다.
--   free   — 월 1회 (맛보기)
--   basic  — 월 100회 (19,800원/월)
--   pro    — 월 300회 (29,800원/월)
-- 실제 결제(토스 정기결제)와 검색 차단은 2단계에서 켠다.
--
-- 구독 행이 없으면 free 로 취급(코드 기본값). 쓰기는 서버(service_role)만.
-- 오너 계정은 배포 후 수동으로 pro 로 올린다(아래 주석 참고). 재실행 가능.
-- =============================================================================

create table if not exists public.subscriptions (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  plan                 text not null default 'free',
  status               text not null default 'active',
  billing_cycle        text,               -- 'monthly' | 'yearly' | null (2단계)
  current_period_end   timestamptz,
  provider             text,               -- 'toss' (2단계)
  provider_billing_key text,               -- 정기결제 키 (2단계)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint subscriptions_plan_chk check (plan in ('free', 'basic', 'pro'))
);

alter table public.subscriptions enable row level security;

-- 본인 구독만 조회. 쓰기 정책 없음 → service_role(서버)만 수정.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'subscriptions'
       and policyname = 'subscriptions_self_read'
  ) then
    create policy subscriptions_self_read on public.subscriptions
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- 배포 후 오너를 pro 로 올리는 예시 (user_id 를 본인 것으로 바꿔 실행):
--   insert into public.subscriptions (user_id, plan) values ('<OWNER_USER_ID>', 'pro')
--   on conflict (user_id) do update set plan = 'pro', updated_at = now();
