'use client';

import { useEffect, useState } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

import { type InstagramCreator } from '../instagram';

type CreatorState = {
  status: 'loading' | 'ready' | 'notfound' | 'unavailable';
  creator: InstagramCreator | null;
  /** discovered_creators.updated_at — used as "마지막 발견일". */
  updatedAt: string | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- DB row is loosely typed */
function rowToCreator(r: any): InstagramCreator {
  return {
    id: r.external_id,
    platform: 'instagram',
    username: r.username,
    displayName: r.display_name ?? r.username,
    profileUrl: r.profile_url,
    profileImageUrl: r.profile_image_url ?? null,
    biography: r.biography ?? null,
    followersCount: r.followers_count ?? null,
    followingCount: r.following_count ?? null,
    postsCount: r.posts_count ?? null,
    isVerified: Boolean(r.is_verified),
    category: r.category ?? null,
    rawData: r.raw_data,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Fetch a single discovered creator (by external_id) for the signed-in user via
 * the browser Supabase client (RLS scopes it to that user). In mock mode / signed
 * out it resolves to 'unavailable' so the page can render a clear empty state.
 */
export function useCreator(id: string): CreatorState {
  const [state, setState] = useState<CreatorState>({
    status: 'loading',
    creator: null,
    updatedAt: null,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isSupabaseConfigured()) {
        if (active) setState({ status: 'unavailable', creator: null, updatedAt: null });
        return;
      }
      try {
        const sb = createClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) {
          if (active) setState({ status: 'unavailable', creator: null, updatedAt: null });
          return;
        }
        const { data } = await sb
          .from('discovered_creators')
          .select(
            'external_id,username,display_name,profile_url,profile_image_url,biography,followers_count,following_count,posts_count,is_verified,category,updated_at,raw_data',
          )
          .eq('user_id', user.id)
          .eq('external_id', id)
          .limit(1)
          .maybeSingle();
        if (!active) return;
        if (!data) {
          setState({ status: 'notfound', creator: null, updatedAt: null });
          return;
        }
        setState({
          status: 'ready',
          creator: rowToCreator(data),
          updatedAt: (data as { updated_at?: string }).updated_at ?? null,
        });
      } catch {
        if (active) setState({ status: 'unavailable', creator: null, updatedAt: null });
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return state;
}
