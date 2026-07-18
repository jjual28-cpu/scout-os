-- =============================================================================
-- Scout OS — 0018: Billing (Toss 정기결제) — phase 2
--
-- 구독을 실제 결제로 잇는다. subscriptions 에 토스 빌링 식별자와 해지예약 플래그를
-- 추가하고, 청구 이력(payments)을 남긴다(영수증·정산·문의·환불 대비).
--
-- 결제/청구는 서버(service_role)만 수행하므로 payments 는 RLS on + 본인 조회만.
-- 재실행 가능(idempotent).
-- =============================================================================

alter table public.subscriptions
  add column if not exists customer_key text,          -- 토스 customerKey (=user_id 기반)
  add column if not exists cancel_at_period_end boolean not null default false;

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  plan          text not null,
  amount        integer not null,          -- 청구 금액(원)
  billing_cycle text,                       -- monthly | yearly
  status        text not null,             -- 'paid' | 'failed'
  provider      text not null default 'toss',
  order_id      text,                       -- 토스 orderId
  payment_key   text,                       -- 토스 paymentKey
  raw           jsonb,                      -- 토스 응답 원본(감사용)
  created_at    timestamptz not null default now()
);

create index if not exists payments_user_idx on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'payments'
       and policyname = 'payments_self_read'
  ) then
    create policy payments_self_read on public.payments
      for select using (auth.uid() = user_id);
  end if;
end $$;
