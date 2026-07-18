'use client';

import { useEffect, useState } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

import { PLANS, toPlanKey, type Plan } from '../plans';

type SubState = {
  plan: Plan;
  /** Searches (campaigns) this calendar month. */
  used: number;
  /** True when a paid plan is set to end at the current period. */
  cancelAtPeriodEnd: boolean;
  hydrated: boolean;
  signedIn: boolean;
};

function startOfMonthISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/**
 * The current user's plan + this month's search usage, for the settings screen.
 * Read-only display (phase 1). Mock mode / signed-out → free plan, 0 used.
 */
export function useSubscription(): SubState {
  const [state, setState] = useState<SubState>({
    plan: PLANS.free,
    used: 0,
    cancelAtPeriodEnd: false,
    hydrated: false,
    signedIn: false,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isSupabaseConfigured()) {
        if (active)
          setState({
            plan: PLANS.free,
            used: 0,
            cancelAtPeriodEnd: false,
            hydrated: true,
            signedIn: false,
          });
        return;
      }
      try {
        const sb = createClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) {
          if (active)
            setState({
              plan: PLANS.free,
              used: 0,
              cancelAtPeriodEnd: false,
              hydrated: true,
              signedIn: false,
            });
          return;
        }

        const [sub, searches] = await Promise.all([
          sb
            .from('subscriptions')
            .select('plan,cancel_at_period_end')
            .eq('user_id', user.id)
            .maybeSingle(),
          sb
            .from('campaigns')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', startOfMonthISO()),
        ]);

        if (!active) return;
        const subRow = sub.data as { plan?: string; cancel_at_period_end?: boolean } | null;
        const planKey = toPlanKey(subRow?.plan);
        setState({
          plan: PLANS[planKey],
          used: searches.count ?? 0,
          cancelAtPeriodEnd: Boolean(subRow?.cancel_at_period_end),
          hydrated: true,
          signedIn: true,
        });
      } catch {
        if (active)
          setState({
            plan: PLANS.free,
            used: 0,
            cancelAtPeriodEnd: false,
            hydrated: true,
            signedIn: false,
          });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}
