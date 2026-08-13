import { z } from 'zod';

/**
 * Lenient environment access — NEVER throws at import/boot/build.
 *
 * The MVP runs on mock data + localStorage, so external services (Supabase, the
 * database) are optional. Missing or malformed values simply become `undefined`,
 * which puts the corresponding feature into "mock mode". Each feature validates
 * what IT needs at the point of use via the `is*Configured()` helpers below —
 * we never gate the whole app on env at startup.
 */

const urlSchema = z.string().url();
const nonEmpty = z.string().min(1);

/** Return the parsed value if it satisfies the schema, otherwise `undefined`. */
function optional<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

/**
 * Normalize a Supabase project URL to its ORIGIN only (scheme://host[:port]).
 *
 * supabase-js builds every endpoint by resolving a relative path against this
 * value (`new URL("auth/v1", base)`), so any trailing path leaks in — e.g. a
 * value of `https://ref.supabase.co/rest/v1` makes auth calls hit
 * `.../rest/v1/auth/v1/signup` → "Invalid path specified in request URL".
 * Stripping to the origin makes the client robust to a misconfigured URL.
 */
function toSupabaseOrigin(value: string | undefined): string | undefined {
  const parsed = optional(urlSchema, value);
  if (!parsed) return undefined;
  try {
    return new URL(parsed).origin;
  } catch {
    return undefined;
  }
}

// NEXT_PUBLIC_* vars must be referenced statically so Next.js can inline them
// into the client bundle. Non-public vars are `undefined` in the browser.
export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  // App (public, with safe defaults). Trailing slashes stripped so that
  // `${NEXT_PUBLIC_APP_URL}/auth/callback` never produces a double slash.
  NEXT_PUBLIC_APP_URL: (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(
    /\/+$/,
    '',
  ),
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? 'Scout OS',

  // Supabase (optional — undefined ⇒ auth runs in mock mode).
  // Normalized to the origin so a stray path like /rest/v1 can't corrupt the
  // auth/storage endpoints supabase-js derives from it.
  NEXT_PUBLIC_SUPABASE_URL: toSupabaseOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional(nonEmpty, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  SUPABASE_SERVICE_ROLE_KEY: optional(nonEmpty, process.env.SUPABASE_SERVICE_ROLE_KEY),

  // Database (optional — undefined ⇒ DB-backed APIs are unavailable)
  DATABASE_URL: optional(urlSchema, process.env.DATABASE_URL),
  DIRECT_URL: optional(urlSchema, process.env.DIRECT_URL),

  // AI (optional — undefined ⇒ AI features unavailable; MVP uses local templates)
  ANTHROPIC_API_KEY: optional(nonEmpty, process.env.ANTHROPIC_API_KEY),
  OPENAI_API_KEY: optional(nonEmpty, process.env.OPENAI_API_KEY),
  AI_DEFAULT_PROVIDER: (process.env.AI_DEFAULT_PROVIDER as 'anthropic' | 'openai') ?? 'anthropic',
  AI_DEFAULT_MODEL: process.env.AI_DEFAULT_MODEL ?? 'claude-sonnet-5',

  // OpenRouter (server-only — NEVER prefix with NEXT_PUBLIC). ONE platform key
  // billed to the operator; all users share it, capped per-user per-day. The key
  // never reaches the browser. Undefined ⇒ AI features report "not configured".
  OPENROUTER_API_KEY: optional(nonEmpty, process.env.OPENROUTER_API_KEY),
  // Google AI Studio (Gemini) — 무료 티어(카드 불필요). 설정 시 OpenRouter 대신 이걸
  // 우선 사용. aistudio.google.com → Get API key. OpenAI 호환 엔드포인트로 호출한다.
  GOOGLE_AI_API_KEY: optional(nonEmpty, process.env.GOOGLE_AI_API_KEY),
  // ⚠️ 이 키/프로젝트에서 버전 지정명(gemini-2.0-flash·2.5-flash 등)은 404("모델 없음")로
  // 실패하고, '-latest' 별칭만 실제 동작함(실측 확인). 기본값을 gemini-flash-latest로.
  GOOGLE_AI_MODEL: process.env.GOOGLE_AI_MODEL ?? 'gemini-flash-latest',
  // 기본값을 flash로 — lite는 '넛츠 검색에 복지단체/자사몰이 섞여도 통과'처럼 주제
  // 관련성·업체 판별이 약했다. flash는 아이디+소개+링크를 종합 판단해 훨씬 잘 거른다.
  // (검색 1회당 몇 원 차이, 하루 상한으로 폭주 방지.) env로 언제든 오버라이드 가능.
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash',
  /** Vision-capable model for image-based (외모/머릿결 등) 셀럽 판정. */
  OPENROUTER_VISION_MODEL: process.env.OPENROUTER_VISION_MODEL ?? 'google/gemini-2.5-flash',
  /** Per-user AI calls allowed per day (Asia/Seoul). Guards the shared key. */
  AI_DAILY_LIMIT: ((): number => {
    const n = Number.parseInt(process.env.AI_DAILY_LIMIT ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : 50;
  })(),

  CRON_SECRET: optional(nonEmpty, process.env.CRON_SECRET),

  // Toss Payments (정기결제/빌링). Secret key is SERVER-ONLY (charges cards);
  // client key is public (frontend card-registration SDK). Undefined ⇒ 결제 비활성.
  TOSS_SECRET_KEY: optional(nonEmpty, process.env.TOSS_SECRET_KEY),
  NEXT_PUBLIC_TOSS_CLIENT_KEY: optional(nonEmpty, process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY),

  // 카페24 (server-only — NEVER prefix with NEXT_PUBLIC). App credentials from the
  // Cafe24 Developer Center; used only in the OAuth flow that connects a brand's
  // mall. Undefined ⇒ 카페24 임포트 비활성. The secret NEVER reaches the browser.
  CAFE24_CLIENT_ID: optional(nonEmpty, process.env.CAFE24_CLIENT_ID),
  CAFE24_CLIENT_SECRET: optional(nonEmpty, process.env.CAFE24_CLIENT_SECRET),

  // 인스타 Messaging (Meta). App secret·verify token 은 SERVER-ONLY. App ID 는
  // OAuth 리다이렉트에 쓰여 public 도 둔다. 웹훅 서명검증에 app secret 사용.
  INSTAGRAM_APP_ID: optional(nonEmpty, process.env.INSTAGRAM_APP_ID),
  INSTAGRAM_APP_SECRET: optional(nonEmpty, process.env.INSTAGRAM_APP_SECRET),
  INSTAGRAM_WEBHOOK_VERIFY_TOKEN: optional(nonEmpty, process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN),
  NEXT_PUBLIC_INSTAGRAM_APP_ID: optional(nonEmpty, process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID),

  // Apify (server-only — NEVER prefix with NEXT_PUBLIC). Powers real Instagram
  // creator discovery. Undefined ⇒ /discover falls back to mock data.
  APIFY_API_TOKEN: optional(nonEmpty, process.env.APIFY_API_TOKEN),
  APIFY_INSTAGRAM_ACTOR: process.env.APIFY_INSTAGRAM_ACTOR ?? 'apify~instagram-scraper',
  /** Posts that TAG a given account → the creators already doing brand work. */
  APIFY_TAGGED_ACTOR: process.env.APIFY_TAGGED_ACTOR ?? 'apify~instagram-tagged-scraper',
  /** 틱톡 해시태그 스크레이퍼 — 영상+작성자(아이디·팔로워·소개)를 준다. */
  APIFY_TIKTOK_ACTOR: process.env.APIFY_TIKTOK_ACTOR ?? 'clockworks~tiktok-hashtag-scraper',
  /** 유튜브 스크레이퍼 — 키워드 검색으로 채널(구독자·소개)을 준다. */
  APIFY_YOUTUBE_ACTOR: process.env.APIFY_YOUTUBE_ACTOR ?? 'streamers~youtube-scraper',

  // Discovery provider (server-only). Selects how /discover sources creators:
  //   'worker' — enqueue a job for the local Playwright worker (packages/worker)
  //   'apify'  — call the Apify actor inline (requires APIFY_API_TOKEN)
  // Undefined/other ⇒ auto: use Apify if a token is present, else mock data.
  DISCOVERY_PROVIDER: optional(nonEmpty, process.env.DISCOVERY_PROVIDER),
} as const;

export type Env = typeof env;

/** True when Supabase auth is configured (public URL + anon key present). */
export function isSupabaseConfigured(): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** True when a database connection string is configured. */
export function isDatabaseConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
}

/** True when at least one AI provider key is configured. */
export function isAiConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY);
}

/** True when the shared OpenRouter platform key is configured (server-side). */
export function isAiPlatformConfigured(): boolean {
  return Boolean(env.OPENROUTER_API_KEY);
}

/** True when Apify is configured (server-only token present). */
export function isApifyConfigured(): boolean {
  return Boolean(env.APIFY_API_TOKEN);
}

/** True when Toss Payments is configured (secret + public client key). */
export function isTossConfigured(): boolean {
  return Boolean(env.TOSS_SECRET_KEY && env.NEXT_PUBLIC_TOSS_CLIENT_KEY);
}

/** True when 카페24 app credentials are configured (server-only). */
export function isCafe24Configured(): boolean {
  return Boolean(env.CAFE24_CLIENT_ID && env.CAFE24_CLIENT_SECRET);
}

/** True when 인스타 Messaging(Meta) app credentials are configured (server-only). */
export function isInstagramConfigured(): boolean {
  return Boolean(
    env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET && env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN,
  );
}

/**
 * Which discovery provider /discover should use.
 *  - 'worker': enqueue a job for the local Playwright worker (packages/worker)
 *  - 'apify':  run the Apify actor inline
 *  - 'mock':   always serve mock data
 * Defaults to 'worker' when explicitly set; otherwise auto — Apify if a token
 * exists, else mock.
 */
export function getDiscoveryProvider(): 'worker' | 'apify' | 'mock' {
  const explicit = env.DISCOVERY_PROVIDER?.toLowerCase();
  if (explicit === 'worker' || explicit === 'apify' || explicit === 'mock') return explicit;
  return isApifyConfigured() ? 'apify' : 'mock';
}

/**
 * Absolute URL Supabase should send email-confirmation / OAuth links back to.
 *
 * The production URL is read ONLY from `NEXT_PUBLIC_APP_URL` (never hardcoded);
 * locally that resolves to `http://localhost:3000`. If the env var isn't set at
 * all, we fall back to the live browser origin so the link still returns to the
 * exact deployment the user signed up on — never a stale/other host.
 */
export function getAuthCallbackUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  const base =
    explicit || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${base}/auth/callback`;
}
