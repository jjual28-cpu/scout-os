import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { suggestKeywords } from '@/services/ai/keywords';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  product: z.object({
    name: z.string().max(200).nullish(),
    brand: z.string().max(200).nullish(),
    category: z.string().max(120).nullish(),
    usp: z.string().max(1000).nullish(),
    sellingPoints: z.string().max(2000).nullish(),
    target: z.string().max(500).nullish(),
  }),
});

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/ai/keywords — suggest Instagram search keywords for a product.
 * Counts against the caller's daily AI cap. Auth required.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '서버가 구성되지 않았습니다.', 503);

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  const body = bodySchema.parse(await request.json());
  const keywords = await suggestKeywords(userId, body.product);
  return ok({ keywords });
});
