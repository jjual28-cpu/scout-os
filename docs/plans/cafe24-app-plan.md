# Scout OS → 카페24 앱스토어 앱 — 구현 플랜

결정(2026-08-15): **① 계정 = org 워크스페이스(확장성)** · **② 독립형(scout.flownit.kr 토스)과
카페24 앱 병행**(코드는 멀티테넌트로 공유). 큰 아키텍처 작업이라 단계별로.

---
## ▶ 내일 회사PC에서 시작하기 (인수인계)
1. `cd <scout-os> && git pull` (이 문서·worklog 최신화)
2. Claude에게 **"카페24 앱 플랜 이어서, Phase 1 시작하자"** 라고 말하기.
3. 진행 판단:
   - **Phase 0(카페24 개발자센터에 앱 등록)을 아직 안 했으면** → 그것부터 (아래 Phase 0). client_id/secret 필요.
   - 앱 등록만 됐으면 client_id/secret 없이도 **Phase 1(org 멀티테넌트 토대)은 먼저 코딩 가능** — 이게 제일 크고 카페24와 독립적이라 여기부터 시작 권장.
4. ⚠️ **실사용자 9명 데이터**가 걸린 마이그레이션이라, Phase 1은 백필·RLS를 특히 조심(로컬 mock라
   검증 제한 → 마이그 SQL·백필을 사용자가 Supabase에서 신중히 실행).

**오늘까지 완료 상태(독립형)**: 검색 대개편·릴스음원 기능·법적표기 완비(통신판매업 제2026-서울동대문
-1413호, 연락처 flownitlabs@gmail.com/010-9650-5333). 결제(토스)·도메인 준비됨. → 카페24는 이 위에 얹음.

## 핵심 아이디어
- 카페24 쇼핑몰 사장님 = 우리 고객(체험단·공구·협찬 필요 브랜드). 앱스토어 유입 = 싼 CAC.
- **킬러기능**: 카페24 상품 자동 불러와 AI가 "내 상품 맞춤 셀럽" 매칭(지금은 상품 수동선택).
- **♻️ 셀링크(cellink) 재사용**: 카페24 앱 인프라(개발자계정·심사·`/cafe24/entry` HMAC·OAuth·상품
  fetch·몰→org 멀티테넌트·정액제 빌링) 이미 해봄 → 포팅.

## Phase 0 — 셋업 (사용자 액션 + env)
- **[사용자]** 카페24 개발자센터(flownitlabs 계정)에 **Scout OS 앱 신규 등록**(셀링크와 별도
  client_id/secret). Redirect URI = `https://scout.flownit.kr/api/cafe24/callback`(도메인 확정 후).
  스코프: `mall.read_application, mall.read_product, mall.read_store`(상품·몰정보 읽기) 우선.
- **[me]** Vercel env: `CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`, `CAFE24_APP_...` 스캐폴딩.

### ✅ Phase 0 진행상황 (2026-08-15 밤, flownitlabs 개발자센터)
- **앱 생성 완료** (client_id 발급됨 — ⚠️ 값은 git에 안 올림, Vercel env로만).
- **Redirect URI 입력**: `https://scout-os.kr/api/cafe24/callback` (루트 도메인이라 OK).
- **권한(scope) 확정**: **앱(Application)·상점(Store 읽기)·상품(Product 읽기)·상품분류(Category 읽기)** 4개.
  → 공급사(Supply)·고객식별자(Customer Identifier)는 **불필요라 삭제**(심사 거부 위험 회피). 타임존 Asia/Seoul.
- **⏭️ 내일 이어서(회사PC)**:
  1. 앱스토어 등록 상세정보(앱 소개·상세설명·개인정보/약관 링크) 채우기.
  2. **이미지 제작**(앱 아이콘·대표이미지·스크린샷 등) — Claude가 만들어 줄 수 있음(디자인/이미지 툴).
  3. client_id/secret → Vercel env(`CAFE24_CLIENT_ID`/`CAFE24_CLIENT_SECRET`) 넣기.
  4. → 코드: Phase 1(org) 또는 Phase 2(entry/OAuth 콜백) 시작.

## Phase 1 — org 멀티테넌트 토대 (제일 큼, 신중히) — 상세
현재는 전부 `user_id`(Supabase auth) 기준. org 레이어를 **얹되(무중단), 기존 동작은 그대로** 유지.
핵심 전략: **org_id를 nullable로 추가 → 백필 → 앱은 "활성 org" 자동 해석 → 나중에 not null**.

### 1-A. 마이그레이션(0029) — 신규 테이블
```sql
-- organizations: 워크스페이스(독립형 개인 org 또는 카페24 몰 org)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id),
  source text not null default 'independent',   -- 'independent' | 'cafe24'
  cafe24_mall_id text unique,                    -- 카페24 몰 식별(있으면)
  created_at timestamptz not null default now()
);
-- 멤버십: 한 org에 여러 user(팀). 지금은 owner 1명이지만 구조는 확장형.
create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',            -- 'owner' | 'member'
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
-- 내가 속한 org만 읽기
create policy org_read on public.organizations for select to authenticated
  using (id in (select org_id from public.organization_members where user_id = auth.uid()));
create policy orgmem_read on public.organization_members for select to authenticated
  using (user_id = auth.uid() or org_id in (
    select org_id from public.organization_members where user_id = auth.uid()));
```

### 1-B. 마이그레이션(0030) — 기존 테이블에 org_id 추가 + 백필
- **org_id 추가 대상**(유저 소유 데이터): `campaigns`, `discovered_creators`, `campaign_results`,
  `outreach_activities`, `products`, `subscriptions`, `instagram_connections`, `instagram_messages`,
  `saved_*`(있으면), `ai_usage`(유저별→org별로 볼지 결정). **전역(예외, org 무관)**: `reel_audio_snapshots`.
- 각 테이블: `alter table X add column org_id uuid references organizations(id);`
- **백필(핵심, 무중단)**:
```sql
-- 1) 기존 유저마다 개인 org 생성 + 본인 owner 멤버십
insert into organizations (name, owner_user_id, source)
  select coalesce(email,'내 워크스페이스'), id, 'independent' from auth.users
  on conflict do nothing;
insert into organization_members (org_id, user_id, role)
  select o.id, o.owner_user_id, 'owner' from organizations o
  on conflict do nothing;
-- 2) 각 테이블 org_id = 그 유저의 개인 org
update campaigns c set org_id = o.id
  from organizations o where o.owner_user_id = c.user_id and c.org_id is null;
--   … (org_id 추가한 모든 테이블 반복)
```
- 백필 검증 후, 다음 배포에서 `org_id not null` + RLS 전환.

### 1-C. RLS 전환(0031, 백필 확인 후)
- 각 테이블 정책을 `user_id = auth.uid()` → **`org_id in (내 멤버십 org들)`** 로 교체.
  (owner만 있는 지금은 결과 동일 → 안전. 나중에 팀원 추가 시 자동 공유.)

### 1-D. 앱 데이터 접근 레이어 — "활성 org" 해석
- 신규 `lib/org/current.ts`(server): 현재 user → 활성 org_id 반환(멤버십 중 최근/기본).
  세션·쿠키에 `active_org_id` 저장(여러 org 전환 대비). 없으면 개인 org.
- 신규 행 insert 시 `org_id = activeOrg` 세팅(services 레이어). 조회는 RLS가 자동 스코프하지만,
  admin client(서비스롤) 경로(cron·status route 등)는 **명시적으로 org_id 필터** 추가.
- **점진 적용**: 우선 "1 user = 1 org"라 기존 코드 거의 안 깨짐. org_id 세팅만 추가 → 이후 팀·몰 확장.

### 1-E. 파일(예상)
- `supabase/migrations/0029_*.sql`, `0030_*.sql`, `0031_*.sql`
- `apps/web/src/lib/org/current.ts`(활성 org), `apps/web/src/features/org/*`(워크스페이스 전환 UI, 후순위)
- services 레이어에서 insert 시 org_id 주입(campaign 생성·저장 등 write 지점).

### 1-F. 롤아웃 주의
- 로컬 mock라 실검증 제한 → **백필 SQL은 사용자가 Supabase에서 단계별 실행**(9명 데이터 보존 최우선).
  각 마이그 사이에 `select count(*) where org_id is null` 로 백필 완료 확인 후 다음 단계.
- 독립형 서비스는 그동안 무중단(org_id nullable 단계에선 기존 쿼리 그대로 동작).

## Phase 2 — 카페24 연동 (셀링크 포팅)
- `/api/cafe24/entry`(앱 진입 HMAC 검증) · `/api/cafe24/callback`(OAuth, state에 mall 인코딩) ·
  토큰 저장(mall별).
- **몰↔org 브릿지**: 앱 첫 설치 시 그 몰용 org 생성/연결 + headless 계정(카페24 세션 ↔ Supabase user)
  매핑. (셀링크의 몰→org 로직 참고 — 제일 까다로운 부분.)

## Phase 3 — 상품 동기화
- `services/cafe24/mall.ts` 상품 fetch → Scout `products`(org-scoped)로 upsert.
- AI 매칭이 이미 products의 BrandContext 사용 → **실상품만 넣으면 매칭 품질 자동 상승**(추가 로직 최소).
- "카페24 상품에서 불러오기" UI(상품 선택 화면에).

## Phase 4 — 결제 (병행)
- **카페24 앱은 자체결제(토스) 금지** → **카페24 정액제 빌링**. `checkSearchLimit` 한도 로직 재사용.
- 독립형(scout.flownit.kr)은 **토스 유지**. org.source 로 분기(cafe24=정액제, independent=토스).

## Phase 5 — 앱스토어 심사·런칭
- 앱 소개·스크린샷·개인정보/약관·심사 제출. 셀링크 심사 노하우 재사용.

## 실행 순서 제안
Phase 0(사용자 앱등록) → **Phase 1(org 토대, 가장 신중)** → 2 → 3 → 4 → 5.
독립형은 그동안 그대로 서비스(병행). Phase 1은 실사용자 데이터가 걸려 있어 백필·RLS를 특히 조심.

## 참고
- 관련 인프라: [[cellink-fandeal-saas]](메모리) — 카페24 앱 개발자계정·심사·데이터브릿지 이미 경험.
- 도메인·결제·법적표기(사업자정보 완비: 통신판매업 제2026-서울동대문-1413호)는 독립형 기준 완료됨.
