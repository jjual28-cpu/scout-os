-- =============================================================================
-- Scout OS — products (brand product catalog for AI-driven creator matching)
--
-- The brand's products. AI Engine (next feature) will read these to recommend
-- keywords + creators. One row per product, RLS-scoped to the owning user.
-- Apply in the Supabase SQL editor.
-- =============================================================================

create table if not exists public.products (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_code          text,                   -- AI Engine 참조용 코드 (예: VNT001)
  is_active             boolean not null default true, -- 검색/AI 대상 여부
  name                  text not null,          -- 상품
  brand                 text,                   -- 브랜드
  category              text,                   -- 카테고리
  image_url             text,                   -- 대표 이미지 URL
  status                text not null default '준비중', -- 판매중 | 준비중 | 품절 | 중지
  -- collab_type stores one or more of 제품제공/수익쉐어/게런티/협의 (comma-separated)
  price                 numeric,                -- 판매가
  commission            numeric,                -- 수수료(%)
  revenue_share_pct     numeric,                -- 기본 수익쉐어율(%)
  collab_type           text,                   -- 제품제공 | 수익쉐어 | 게런티 | 협의
  usp                   text,                   -- USP
  selling_points        text,                   -- 판매 포인트
  banned_phrases        text,                   -- 금지 문구
  collab_terms          text,                   -- 협업 조건
  target                text,                   -- 추천 타겟
  recommended_keywords  text,                   -- 추천 키워드 (AI Engine 사용, 쉼표 구분)
  analysis              text,                   -- AI 상품 분석 결과 (다음 단계 AI Engine이 채움)
  analysis_source       text,                   -- 분석 출처 (예: rule | openai)
  analysis_updated_at   timestamptz,            -- AI 분석 시각
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists products_user_idx on public.products (user_id, updated_at desc);
-- product_code unique per user (nulls allowed)
create unique index if not exists products_code_uniq
  on public.products (user_id, product_code) where product_code is not null;

-- -----------------------------------------------------------------------------
-- Row Level Security — a user may only read/write their OWN products
-- -----------------------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "products_select_own" on public.products;
create policy "products_select_own" on public.products
  for select using (auth.uid() = user_id);

drop policy if exists "products_insert_own" on public.products;
create policy "products_insert_own" on public.products
  for insert with check (auth.uid() = user_id);

drop policy if exists "products_update_own" on public.products;
create policy "products_update_own" on public.products
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "products_delete_own" on public.products;
create policy "products_delete_own" on public.products
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- updated_at trigger (reuses the shared set_updated_at function)
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
