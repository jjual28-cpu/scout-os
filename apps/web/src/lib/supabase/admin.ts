import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

/**
 * Privileged Supabase client using the service-role key. Bypasses Row Level
 * Security — use ONLY in trusted server contexts (cron jobs, webhooks, admin
 * tasks). The `server-only` import guarantees this never ships to the browser.
 *
 * Throws if the URL / service-role key are not configured.
 */
export function createAdminClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service role is not configured (mock mode).');
  }
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Next.js 14 patches fetch and keeps responses in its Data Cache unless the
    // request reads cookies/headers. Routes that only use this client (partner
    // API, cron) then got the FIRST read back forever — a running search looked
    // stuck at stage 1 while the DB had moved on. DB state must always be live.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}
