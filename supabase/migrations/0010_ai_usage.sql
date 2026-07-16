-- =============================================================================
-- Scout OS — 0010: Per-user daily AI usage cap (shared platform key)
--
-- AI 는 Scout OS 대표 OpenRouter 키(운영자 충전) 하나로 동작한다. 폭주로 인한
-- 비용 사고를 막기 위해 사용자마다 "하루 N회" 상한을 둔다. 상한값은 앱의
-- AI_DAILY_LIMIT 환경변수에서 넘어온다(코드/DB 어디에도 하드코딩하지 않음).
--
-- 재실행 가능(idempotent). 기존 테이블 변경/삭제 없음.
-- =============================================================================

create table if not exists public.ai_usage (
  user_id    uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,               -- Asia/Seoul 기준 날짜
  calls      int  not null default 0,
  primary key (user_id, usage_date)
);

alter table public.ai_usage enable row level security;

-- 사용자는 본인 사용량만 조회 (설정 페이지의 "오늘 X/N회" 표시용)
drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select to authenticated using (auth.uid() = user_id);
-- 쓰기 정책 없음 → 브라우저는 카운트를 조작할 수 없다. 증가는 아래 함수로만.

-- ── 원자적 증가 + 상한 검사 (service_role 전용) ──────────────────────────────
--     반환값: 증가 후 오늘 호출 수. 상한 초과로 증가하지 못하면 -1.
create or replace function public.bump_ai_usage(p_user uuid, p_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_calls int;
begin
  insert into public.ai_usage (user_id, usage_date, calls)
       values (p_user, v_today, 1)
  on conflict (user_id, usage_date) do update
       set calls = public.ai_usage.calls + 1
       where public.ai_usage.calls < p_limit
  returning calls into v_calls;

  return coalesce(v_calls, -1); -- null ⇒ 상한 초과로 갱신 안 됨
end $$;

revoke all on function public.bump_ai_usage(uuid, int) from public;
grant execute on function public.bump_ai_usage(uuid, int) to service_role;
