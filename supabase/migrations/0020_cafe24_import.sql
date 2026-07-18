-- =============================================================================
-- Scout OS — 0020: 카페24 상품 임포트 (OAuth 연동 + 출처 표시)
--
-- 브랜드가 자기 카페24 몰을 OAuth로 연동하고, 상품을 골라 Scout OS products 로
-- 끌어온다. 액세스/리프레시 토큰은 민감정보이므로 이 테이블은 service_role 만
-- 읽고 쓴다 — self SELECT 정책을 만들지 않아 클라이언트(anon/authenticated)는
-- 토큰에 접근할 수 없다. 연동 여부/mall_id 는 서버 라우트가 admin 으로 조회해
-- 필요한 필드만 내려준다.
--
-- 재실행 가능(idempotent).
-- =============================================================================

create table if not exists public.cafe24_connections (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  mall_id                   text not null,               -- 카페24 몰 ID (subdomain)
  access_token              text not null,               -- 2시간 만료
  refresh_token             text not null,               -- 약 2주 만료
  expires_at                timestamptz not null,        -- access_token 만료 시각
  refresh_token_expires_at  timestamptz,                 -- refresh_token 만료 시각
  scopes                    text,                        -- 발급된 scope (예: mall.read_product)
  connected_at              timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- RLS on, 정책 없음 = anon/authenticated 접근 전면 차단. service_role 만 접근.
alter table public.cafe24_connections enable row level security;

drop trigger if exists cafe24_conn_set_updated_at on public.cafe24_connections;
create trigger cafe24_conn_set_updated_at
  before update on public.cafe24_connections
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 중복 임포트 방지: products 에 출처(source) + 원본 상품번호를 남긴다.
-- 같은 카페24 상품을 두 번 임포트하지 않도록 (user_id, source, source_product_no)
-- 유니크. 손으로 만든 상품(source is null)은 제약 대상 아님.
-- -----------------------------------------------------------------------------
alter table public.products
  add column if not exists source            text,       -- 'cafe24' 등
  add column if not exists source_product_no text;       -- 카페24 product_no

create unique index if not exists products_source_uniq
  on public.products (user_id, source, source_product_no)
  where source is not null and source_product_no is not null;
