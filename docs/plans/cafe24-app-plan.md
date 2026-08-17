# Scout OS → 카페24 앱스토어 앱 — 구현 플랜

결정(2026-08-15): **① 계정 = org 워크스페이스(확장성)** · **② 독립형(scout.flownit.kr 토스)과
카페24 앱 병행**(코드는 멀티테넌트로 공유). 큰 아키텍처 작업이라 단계별로.

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

## Phase 1 — org 멀티테넌트 토대 (제일 큼, 신중히)
현재는 전부 user_id(Supabase auth) 기준. org 레이어 추가:
- **마이그레이션**: `organizations`(id, name, owner_user_id, source[independent|cafe24], cafe24_mall_id),
  `organization_members`(org_id, user_id, role[owner|member]). 핵심 테이블에 `org_id` 추가
  (campaigns·discovered_creators·outreach_activities·products·subscriptions·ai_usage·reel_audio_snapshots는
  전역이라 예외 등).
- **백필**: 기존 9명 각자 → 개인 org 1개(owner) 생성, 그들의 행 org_id 채움. (무중단: org_id nullable로
  넣고 백필 후 not null)
- **RLS**: org 멤버십 기반으로 재작성(user는 자기가 속한 org의 행 접근).
- **데이터 접근 레이어**: 쿼리에 org 컨텍스트 주입(점진 — 우선 현재 user의 활성 org로 자동 스코프).
- ⚠️ 로컬 mock라 검증 제한 → 배포 전 스테이징/신중한 백필 스크립트. 실사용자 9명 데이터 보존 최우선.

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
