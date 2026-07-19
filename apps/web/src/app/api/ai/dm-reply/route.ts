import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { draftReply } from '@/services/ai/dm';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  conversation: z
    .array(
      z.object({
        direction: z.enum(['in', 'out']),
        text: z.string().max(2000),
      }),
    )
    .min(1)
    .max(30),
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
});

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/ai/dm-reply — 셀럽 답장에 대한 다음 답장 초안. 데일리 AI 캡 1회. Auth 필요.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '서버가 구성되지 않았습니다.', 503);

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  const body = bodySchema.parse(await request.json());
  const text = await draftReply(userId, body.conversation, body.brand ?? null);
  return ok({ text });
});
