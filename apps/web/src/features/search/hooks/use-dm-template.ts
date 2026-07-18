'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

/**
 * 사용자별 "DM 스타일" 템플릿 저장/로드.
 *   - Supabase 구성 + 로그인 → profiles.dm_template (계정에 동기화)
 *   - 그 외(mock)          → localStorage
 * 템플릿은 사용자당 1개. 저장은 낙관적(메모리 먼저, 실패해도 UI 유지).
 */
const KEY = 'scout:dm-template';

function readLocal(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}
function writeLocal(v: string) {
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
}

export function useDmTemplate() {
  const [template, setTemplate] = useState<string>('');
  const [hydrated, setHydrated] = useState(false);
  const mode = useRef<'local' | 'supabase'>('local');
  const userId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isSupabaseConfigured()) {
        if (active) {
          mode.current = 'local';
          setTemplate(readLocal());
          setHydrated(true);
        }
        return;
      }
      try {
        const sb = createClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) {
          if (active) {
            mode.current = 'local';
            setTemplate(readLocal());
            setHydrated(true);
          }
          return;
        }
        mode.current = 'supabase';
        userId.current = user.id;
        const { data } = await sb
          .from('profiles')
          .select('dm_template')
          .eq('id', user.id)
          .maybeSingle();
        if (!active) return;
        setTemplate((data as { dm_template: string | null } | null)?.dm_template ?? '');
        setHydrated(true);
      } catch {
        if (active) {
          mode.current = 'local';
          setTemplate(readLocal());
          setHydrated(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(async (next: string): Promise<boolean> => {
    setTemplate(next);
    if (mode.current === 'local') {
      writeLocal(next);
      return true;
    }
    try {
      const { error } = await createClient()
        .from('profiles')
        .upsert({ id: userId.current!, dm_template: next }, { onConflict: 'id' });
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  }, []);

  return { template, hydrated, save };
}
