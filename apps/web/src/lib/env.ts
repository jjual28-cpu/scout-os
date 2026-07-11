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

  CRON_SECRET: optional(nonEmpty, process.env.CRON_SECRET),
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
