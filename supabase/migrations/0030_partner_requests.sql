-- =============================================================================
-- Scout OS — 0030: 셀링크 파트너 추천 API
--
-- 셀링크 서버가 POST /api/partner/recommend 로 인플루언서 추천을 요청한다.
-- 검색(campaign)은 셀링크 전용 서비스 사용자 1명 소유로 만들고, 요청 1건마다
-- partner_requests 1행을 남긴다(어느 몰이 언제 무엇을 요청했는지 · 캐시 재사용인지 ·
-- 새 Apify 실행을 일으켰는지 → 월 상한 계산).
--
-- campaign_results.ai_evidence: AI가 고른 근거 게시물 번호(["P1","P3"]).
-- 파트너 판정에서만 채워지고, 기존 스카우트 OS 검색은 건드리지 않는다(null 유지).
--
-- 새 테이블은 service role(서버)만 읽고 쓴다 — RLS를 켜고 정책을 두지 않는다.
-- 추가만 하는 마이그레이션. 재실행 가능(idempotent).
-- =============================================================================

create table if not exists public.partner_requests (
  id             uuid primary key default gen_random_uuid(),
  partner        text not null default 'cellink',
  mall_id        text not null,
  org_id         text,
  campaign_id    uuid references public.campaigns (id) on delete set null,
  -- 키워드·목적·브랜드 프로필·상품·설명 정규화 해시. 같은 키 = 같은 검색(몰 공용 캐시).
  cache_key      text not null,
  cached         boolean not null default false,  -- 완료된 검색 결과를 재사용
  apify_started  boolean not null default false,  -- 이 요청이 새 Apify 실행을 시작(월 상한에 셈)
  input          jsonb not null default '{}'::jsonb,
  status         text not null default 'running', -- running | succeeded | failed
  error          text,
  result         jsonb,                           -- 완료 시 응답 creators (다시 조회해도 같게)
  result_count   integer,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz,
  constraint partner_requests_status_chk check (status in ('running', 'succeeded', 'failed'))
);

create index if not exists partner_requests_cache_idx
  on public.partner_requests (partner, cache_key, created_at desc);
create index if not exists partner_requests_usage_idx
  on public.partner_requests (partner, created_at desc)
  where apify_started;
create index if not exists partner_requests_mall_idx
  on public.partner_requests (partner, mall_id, created_at desc);

alter table public.partner_requests enable row level security;
-- (정책 없음: anon/authenticated 접근 불가, service role만 사용)

alter table public.campaign_results add column if not exists ai_evidence jsonb;
