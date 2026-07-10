import { createBrowserClient } from '@supabase/ssr';

import { env, isSupabaseConfigured } from '@/lib/env';

/**
 * Supabase client for use in Client Components. Uses the public anon key and is
 * subject to Row Level Security. Safe to call from the browser.
 *
 * Throws if Supabase is not configured — callers must gate on
 * `isSupabaseConfigured()` first (auth runs in mock mode otherwise).
 */
export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured (mock mode).');
  }
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
