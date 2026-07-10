import { cookies } from 'next/headers';

import { createServerClient, type CookieOptions } from '@supabase/ssr';

import { env, isSupabaseConfigured } from '@/lib/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Reads/writes the auth session from the request cookies. Still bound by RLS.
 *
 * Throws if Supabase is not configured — callers must gate on
 * `isSupabaseConfigured()` first.
 */
export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured (mock mode).');
  }
  const cookieStore = cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // `setAll` is called from a Server Component where mutating cookies
          // is disallowed. Safe to ignore when middleware refreshes sessions.
        }
      },
    },
  });
}
