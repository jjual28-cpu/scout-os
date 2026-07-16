import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { storeCredential } from '@/services/ai/credentials';
import { DEFAULT_GEMINI_MODEL, isValidModel, validateGeminiKey } from '@/services/ai/gemini';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  key: z.string().trim().min(20).max(200),
  model: z.string().trim().max(60).optional(),
});

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/ai/connect — save the user's own Gemini key (BYO key).
 *
 * The key is validated against Gemini first (never store an unusable key), then
 * encrypted into Vault. The response NEVER contains the key — only the masked
 * last 4 and the model, for display.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '서버가 구성되지 않았습니다.', 503);

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  const { key, model } = bodySchema.parse(await request.json().catch(() => ({})));
  const chosen = isValidModel(model) ? (model as string) : DEFAULT_GEMINI_MODEL;

  await validateGeminiKey(key, chosen); // throws AppError if the key is bad
  await storeCredential(userId, key, chosen);

  return ok({ connected: true, provider: 'gemini', last4: key.slice(-4), model: chosen });
});
