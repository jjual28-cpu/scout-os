import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';

/**
 * Supabase client for use in Client Components. Uses the public anon key and is
 * subject to Row Level Security. Safe to call from the browser.
 */
export function createClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
