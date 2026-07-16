'use client';

import { useCallback, useEffect, useState } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

/** Connection status the settings UI renders. Never carries the key itself. */
export type AiConnection = {
  connected: boolean;
  last4: string | null;
  model: string | null;
};

/**
 * Reads the signed-in user's AI connection status from `user_ai_credentials`
 * (RLS allows reading only your own row). This exposes just the masked last-4 and
 * model — the actual key stays in Vault and is only ever used server-side.
 */
export function useAiConnection() {
  const [conn, setConn] = useState<AiConnection>({ connected: false, last4: null, model: null });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        setConn({ connected: false, last4: null, model: null });
        setLoading(false);
        return;
      }
      const { data } = await sb
        .from('user_ai_credentials')
        .select('key_last4,model')
        .eq('user_id', user.id)
        .eq('provider', 'gemini')
        .maybeSingle();
      const row = data as { key_last4: string | null; model: string | null } | null;
      setConn(
        row
          ? { connected: true, last4: row.key_last4, model: row.model }
          : { connected: false, last4: null, model: null },
      );
    } catch {
      /* ignore — leave as disconnected */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { conn, loading, reload };
}
