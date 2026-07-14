'use client';

import { useEffect, useState } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

type CurrentUser = { email: string | null; name: string | null };

/**
 * The signed-in user's email + a friendly display name (from user metadata, or
 * derived from the email local-part). Empty in mock mode / signed out — callers
 * fall back to a generic greeting.
 */
export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>({ email: null, name: null });

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured()) return;
    (async () => {
      try {
        const {
          data: { user: u },
        } = await createClient().auth.getUser();
        if (!active || !u) return;
        const meta = (u.user_metadata ?? {}) as { name?: string; full_name?: string };
        const email = u.email ?? null;
        const name = (meta.name || meta.full_name || (email ? email.split('@')[0] : null)) ?? null;
        setUser({ email, name });
      } catch {
        /* stay empty */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return user;
}
