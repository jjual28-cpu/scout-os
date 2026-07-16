'use client';

import { useCallback, useEffect, useState } from 'react';

/** Today's AI usage + the daily cap, for the settings display. */
export type AiUsage = {
  /** Operator has configured the shared platform key. */
  ready: boolean;
  used: number;
  limit: number;
};

export function useAiUsage() {
  const [usage, setUsage] = useState<AiUsage>({ ready: false, used: 0, limit: 0 });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/usage');
      const json = (await res.json().catch(() => null)) as { data?: AiUsage } | null;
      if (json?.data) setUsage(json.data);
    } catch {
      /* ignore — leave defaults */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { usage, loading, reload };
}
