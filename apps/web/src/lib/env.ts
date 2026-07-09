import { z } from 'zod';

/**
 * Runtime-validated environment variables.
 *
 * Server-only secrets live in `server`; browser-exposed values (prefixed with
 * NEXT_PUBLIC_) live in `client`. Importing this module throws at boot if a
 * required variable is missing or malformed — failing fast instead of at the
 * first request.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_DEFAULT_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  AI_DEFAULT_MODEL: z.string().default('claude-sonnet-5'),
  CRON_SECRET: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Scout OS'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/**
 * NEXT_PUBLIC_* vars must be referenced statically for Next.js to inline them
 * into the client bundle, so we build the object explicitly rather than passing
 * `process.env` wholesale.
 */
const clientEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

function formatErrors(error: z.ZodError): string {
  return error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
}

const isServer = typeof window === 'undefined';

// Only validate server vars on the server; the client bundle never sees them.
const parsedServer = isServer
  ? serverSchema.safeParse(process.env)
  : ({ success: true, data: {} } as const);

const parsedClient = clientSchema.safeParse(clientEnv);

if (!parsedServer.success) {
  throw new Error(`❌ Invalid server environment variables:\n${formatErrors(parsedServer.error)}`);
}

if (!parsedClient.success) {
  throw new Error(`❌ Invalid client environment variables:\n${formatErrors(parsedClient.error)}`);
}

export const env = {
  ...(parsedServer.data as z.infer<typeof serverSchema>),
  ...parsedClient.data,
};

export type Env = typeof env;
