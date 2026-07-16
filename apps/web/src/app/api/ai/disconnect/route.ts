import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { deleteCredential } from '@/services/ai/credentials';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/ai/disconnect — remove the user's stored key (Vault secret + row).
 * The key can't be shown again after this; the user re-pastes to reconnect.
 */
export const POST = withErrorHandling(async () => {
  if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '서버가 구성되지 않았습니다.', 503);

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  await deleteCredential(userId);
  return ok({ connected: false });
});
