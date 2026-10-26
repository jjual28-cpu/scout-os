# 셀링크 파트너 추천 API — 구현 계획·확인 항목 (2026-10-26)

약속 문서: `G:\내 드라이브\CLAUDE_PROJECTS\cellink\docs\plans\2026-10-26-scout-os-partner-api.md` (v2). 형식은 그대로 따른다.

## 만드는 것
1. `POST /api/partner/recommend` — Bearer `CELLINK_PARTNER_KEY` 인증 → 입력 검증 → 캐시/진행 중 재사용 → 월 상한 → 서비스 사용자(`CELLINK_SERVICE_USER_ID`) 소유 캠페인 생성 → 기존과 같은 겹침(overlap) Apify 실행 시작.
2. `GET /api/partner/recommend/:requestId` — 인증 → 요청 조회 → 캠페인이 진행 중이면 서버(service role)가 상태 진행 함수를 대신 호출 → 완료되면 기준선·필터·근거 게시물로 골라 응답. 10분 넘으면 failed.
3. 공통 로직 분리: `app/api/campaigns/[campaignId]/status/route.ts` 본문 → `services/campaigns/advance.ts`의 `advanceCampaign(sb, userId, campaignId, opts?)`. 라우트는 호출만.
4. 정확도: `planSearch`·`matchCreators`에 선택 인자 추가(브랜드 프로필·상품·조건·자유 설명 + 게시물 근거). 기존 호출은 인자를 안 넘겨 프롬프트 동일.
5. 근거 게시물: Apify 프로필 상세의 `latestPosts`에서 최근 게시물 6개(링크·글·날짜·형태)를 `recentPosts`로 정규화해 스냅샷에 저장. AI가 근거 게시물 번호를 고르게 하고, 근거 0개면 탈락.
6. DB: `supabase/migrations/0030_partner_requests.sql` — `partner_requests` 테이블(요청별 mallId·orgId·캐시 키·사용 기록), `campaign_results.ai_evidence` 컬럼. 운영 적용은 사용자 승인 후.

## 정상 기준(검증 항목)
- tsc·lint·build·기존 vitest 통과.
- 키 없음/틀림 → 401 `{"error":"unauthorized"}` (env 미설정이어도 401).
- 입력 검증: keywords 0개·6개, limit 21, target 이상값 → 400.
- 캐시 적중(같은 키워드+target+브랜드 프로필+상품명+설명, 72시간, AI 오류 없음) → 200 `{status:"succeeded",cached:true}`, Apify 미호출, 월 상한에 안 셈.
- 같은 키의 진행 중 검색 → 그 캠페인 재사용(202), Apify 미호출.
- 이번 달(KST) 새 Apify 실행 수 ≥ `CELLINK_MONTHLY_LIMIT`(기본 40) → 429 `{"error":"limit_exceeded"}`.
- 결과 기준선: verdict fit, 참여율 ≥ 2%(filters로 더 높게만), 최근 30일(더 짧게만) 게시물, 가짜 팔로워 의심 제외, 쇼핑몰·브랜드 계정 제외(기존 rejectForTarget), excludeUsernames 제외, 근거 게시물 1~3개 필수, 점수 순 최대 limit.
- engagementRate는 기존 `engagementRate()`(%)÷100, isFakeSuspect·reasons는 기존 함수 그대로.
- 기존 Discover 검색·상태 진행 동작 회귀 없음(같은 응답 형태, 같은 프롬프트).
