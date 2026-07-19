import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { judgeVisual, type VisualCandidate } from '@/services/ai/visual';

export const dynamic = 'force-dynamic';
// Several vision calls run concurrently — give the function room.
export const maxDuration = 60;

/** Cost guard: at most this many creators get a (pricey) vision call per run. */
const MAX_JUDGE = 12;

const bodySchema = z.object({ criteria: z.string().trim().min(1).max(300) });

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows / Apify raw_data loosely typed */
/** Up to 2 recent post image URLs from a stored Apify profile item. */
function extractPostImages(raw: any): string[] {
  const posts = Array.isArray(raw?.latestPosts) ? raw.latestPosts : [];
  const urls: string[] = [];
  for (const p of posts) {
    const u =
      p?.displayUrl ?? p?.imageUrl ?? (Array.isArray(p?.images) ? p.images[0] : null) ?? null;
    if (typeof u === 'string' && u.startsWith('http')) urls.push(u);
    if (urls.length >= 2) break;
  }
  return urls;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * POST /api/campaigns/:campaignId/visual — 옵션 비주얼 판정.
 * 텍스트 판정에서 reject가 아닌 후보(상한 12명)의 프로필·게시물 사진을 비전 AI가
 * 보고 오너가 준 시각 기준에 맞는지 판정 → campaign_results.visual_* 저장.
 * 각 후보 1회 비전 호출(데일리 AI 캡에 카운트). Auth + 본인 캠페인.
 */
export const POST = withErrorHandling(
  async (request: NextRequest, { params }: { params: { campaignId: string } }) => {
    if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '서버가 구성되지 않았습니다.', 503);

    const sb = await getSupabase();
    const { data: auth } = await sb.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

    const campaignId = params.campaignId;
    const { criteria } = bodySchema.parse(await request.json());

    // Ownership.
    const { data: camp } = await sb
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!camp) return fail('NOT_FOUND', '캠페인을 찾을 수 없습니다.', 404);

    // Candidates: skip AI-rejected; cap for cost. Best (highest ai_score) first.
    const { data: rows } = await sb
      .from('campaign_results')
      .select('creator_id, ai_verdict, ai_score, creator_snapshot')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId);
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const eligible = ((rows as any[]) ?? [])
      .filter((r) => r.ai_verdict !== 'reject' && r.creator_snapshot?.username)
      .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))
      .slice(0, MAX_JUDGE);
    if (eligible.length === 0) return ok({ judged: 0, fit: 0 });

    // Post images from discovered_creators.raw_data.
    const ids = eligible.map((r) => r.creator_id as string);
    const { data: dc } = await sb
      .from('discovered_creators')
      .select('external_id, raw_data')
      .eq('user_id', userId)
      .in('external_id', ids);
    const postImagesById = new Map<string, string[]>();
    for (const d of (dc as any[]) ?? [])
      postImagesById.set(d.external_id, extractPostImages(d.raw_data));

    const candidates = eligible.map((r) => {
      const snap = r.creator_snapshot as any;
      const images = [snap?.profileImageUrl, ...(postImagesById.get(r.creator_id) ?? [])].filter(
        (u): u is string => Boolean(u),
      );
      return { creatorId: r.creator_id as string, username: snap.username as string, images };
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const forJudge: VisualCandidate[] = candidates.map((c) => ({
      username: c.username,
      images: c.images,
    }));
    const verdicts = await judgeVisual(userId, forJudge, criteria);

    let fit = 0;
    for (const c of candidates) {
      const v = verdicts.get(c.username.toLowerCase());
      if (!v) continue;
      if (v.verdict === 'fit') fit++;
      const { error } = await sb
        .from('campaign_results')
        .update({ visual_score: v.score, visual_verdict: v.verdict, visual_reason: v.reason })
        .eq('user_id', userId)
        .eq('campaign_id', campaignId)
        .eq('creator_id', c.creatorId);
      if (error) console.error(`[visual] save failed (${c.username}): ${error.message}`);
    }

    return ok({ judged: verdicts.size, fit });
  },
);
