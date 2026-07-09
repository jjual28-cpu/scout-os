import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

/**
 * Privileged Supabase client using the service-role key. Bypasses Row Level
 * Security — use ONLY in trusted server contexts (cron jobs, webhooks, admin
 * tasks). The `server-only` import guarantees this never ships to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
