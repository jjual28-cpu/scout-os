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
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash-lite',
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

  // Apify (server-only — NEVER prefix with NEXT_PUBLIC). Powers real Instagram
  // creator discovery. Undefined ⇒ /discover falls back to mock data.
  APIFY_API_TOKEN: optional(nonEmpty, process.env.APIFY_API_TOKEN),
  APIFY_INSTAGRAM_ACTOR: process.env.APIFY_INSTAGRAM_ACTOR ?? 'apify~instagram-scraper',
  /** Posts that TAG a given account → the creators already doing brand work. */
  APIFY_TAGGED_ACTOR: process.env.APIFY_TAGGED_ACTOR ?? 'apify~instagram-tagged-scraper',

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
