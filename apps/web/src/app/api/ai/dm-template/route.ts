import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { fillTemplateSlots } from '@/services/ai/dm';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  creator: z.object({
    displayName: z.string().trim().min(1).max(120),
    username: z.string().trim().min(1).max(120),
    biography: z.string().max(2000).nullish(),
    category: z.string().max(120).nullish(),
    followersCount: z.number().nullish(),
  }),
  brand: z
    .object({
      productName: z.string().max(200).nullish(),
      brand: z.string().max(200).nullish(),
      category: z.string().max(120).nullish(),
      usp: z.string().max(1000).nullish(),
      sellingPoints: z.string().max(2000).nullish(),
      target: z.string().max(500).nullish(),
    })
    .nullish(),
  slots: z.array(z.string().max(300)).max(8),
});

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/ai/dm-template — fill the AI slots of a user's DM template for one
 * creator (personalized). Returns the text for each slot in order. Counts once
 * against the daily AI cap. Auth required.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '서버가 구성되지 않았습니다.', 503);

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  const body = bodySchema.parse(await request.json());
  const texts = await fillTemplateSlots(userId, body.creator, body.brand ?? null, body.slots);
  return ok({ texts });
});
