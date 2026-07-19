-- =============================================================================
-- Scout OS — 0022: 인스타 답장 어드민 수집 (Messaging API + 웹훅)
--
-- 셀럽이 답장하면 Meta 웹훅이 우리 서버로 push → 여기 저장 → 어드민 인박스에서
-- 확인·AI답장·발송. 토큰은 민감정보라 service_role 만(정책 없음 = 클라 차단).
-- 메시지는 본인 것만 조회(self_read) + 읽음 처리(self_update); insert/발신 기록은
-- 서버(웹훅/발송 라우트, service_role). 재실행 가능(idempotent).
-- =============================================================================

-- 인스타 연동 (사용자당 프로 계정 1개). 토큰 서버 전용.
create table if not exists public.instagram_connections (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  ig_user_id          text not null,               -- 프로 계정 Instagram-scoped id (웹훅 recipient 매핑)
  username            text,
  access_token        text not null,               -- long-lived
  token_expires_at    timestamptz,
  connected_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists ig_conn_iguser_idx on public.instagram_connections (ig_user_id);

alter table public.instagram_connections enable row level security; -- 정책 없음 = 클라 차단

drop trigger if exists ig_conn_set_updated_at on public.instagram_connections;
create trigger ig_conn_set_updated_at
  before update on public.instagram_connections
  for each row execute function public.set_updated_at();

-- 대화 메시지 (수신/발신).
create table if not exists public.instagram_messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  peer_id       text not null,                     -- 상대(셀럽) IGSID
  peer_username text,                              -- 알 수 있으면
  direction     text not null,                     -- 'in' | 'out'
  text          text,
  mid           text,                              -- 인스타 message id (중복 방지)
  is_read       boolean not null default false,    -- 어드민 읽음 처리
  created_at    timestamptz not null default now()
);
create index if not exists ig_msg_thread_idx on public.instagram_messages (user_id, peer_id, created_at);
create unique index if not exists ig_msg_mid_uniq on public.instagram_messages (mid) where mid is not null;

alter table public.instagram_messages enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'instagram_messages'
       and policyname = 'ig_msg_self_read'
  ) then
    create policy ig_msg_self_read on public.instagram_messages
      for select using (auth.uid() = user_id);
  end if;

  -- 읽음 처리(update)만 본인 허용. insert/발신 기록은 서버(service_role).
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'instagram_messages'
       and policyname = 'ig_msg_self_update'
  ) then
    create policy ig_msg_self_update on public.instagram_messages
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
