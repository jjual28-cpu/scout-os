-- =============================================================================
-- Scout OS — 0028: reel_audio_snapshots (릴스 트렌드 음원 일별 스냅샷)
--
-- 릴스를 긁어 음원별로 "많이 쓴/고조회"를 집계해 하루 1행씩 저장한다. 매일 스냅샷을
-- 쌓아 며칠 전과 비교하면 "급상승(뜨는 중)"을 계산할 수 있다(v2).
-- 전역 트렌드 데이터(유저 종속 아님) → 로그인 사용자 누구나 읽기, 쓰기는 서비스롤
-- (cron/서버)만. 재실행 가능(idempotent). Supabase SQL 편집기에서 실행 후 배포.
-- =============================================================================

create table if not exists public.reel_audio_snapshots (
  id            uuid primary key default gen_random_uuid(),
  captured_on   date not null default (now() at time zone 'utc')::date,
  captured_at   timestamptz not null default now(),
  scope         text not null,                    -- 분야(키워드) 또는 '전체'
  audio_key     text not null,                    -- audio_id 또는 곡명|아티스트
  audio_id      text,
  song_name     text,
  artist_name   text,
  uses_original boolean not null default false,
  reel_count    integer not null default 0,       -- 이 음원을 쓴 릴스 수(많이 쓴 지표)
  total_views   bigint  not null default 0,
  max_views     bigint  not null default 0,       -- 최고 조회수(고조회 지표)
  avg_views     bigint  not null default 0,
  sample_reels  jsonb   not null default '[]'::jsonb,
  -- 하루/분야/음원 조합은 1행 — 재스크랩 시 upsert.
  unique (captured_on, scope, audio_key)
);

create index if not exists reel_audio_snapshots_scope_day_idx
  on public.reel_audio_snapshots (scope, captured_on desc);

alter table public.reel_audio_snapshots enable row level security;

-- 전역 트렌드라 로그인 사용자 누구나 읽기. 쓰기 정책 없음 → 서비스롤(cron/서버)만 기록.
drop policy if exists reel_audio_snapshots_read on public.reel_audio_snapshots;
create policy reel_audio_snapshots_read
  on public.reel_audio_snapshots
  for select
  to authenticated
  using (true);
