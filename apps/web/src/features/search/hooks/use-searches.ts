'use client';

import { useEffect, useState } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

export type SearchRow = { query: string; resultCount: number; createdAt: string };

/**
 * The signed-in user's recent searches (from the `searches` table), for the
 * dashboard's activity stats and Top Keywords. Empty in mock mode / signed out.
 */
export function useSearches() {
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isSupabaseConfigured()) {
        if (active) setHydrated(true);
        return;
      }
      try {
        const sb = createClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) {
          if (active) setHydrated(true);
          return;
        }
        const { data } = await sb
          .from('searches')
          .select('query,result_count,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(300);
        if (!active) return;
        setRows(
          (data ?? []).map((r) => ({
            query: (r as { query: string }).query,
            resultCount: (r as { result_count: number }).result_count ?? 0,
            createdAt: (r as { created_at: string }).created_at,
          })),
        );
        setHydrated(true);
      } catch {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { rows, hydrated };
}
