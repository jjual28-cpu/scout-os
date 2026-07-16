import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * User AI credential storage. The raw key lives ONLY in Supabase Vault; these
 * helpers reach it through the service-role RPCs (store/get/delete_ai_secret)
 * defined in migration 0009. The key is never stored in a plain column, never
 * returned to the browser, and never logged.
 */

const PROVIDER = 'gemini';

/** Store (or replace) the user's Gemini key in Vault + upsert the pointer row. */
export async function storeCredential(userId: string, key: string, model: string): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.rpc('store_ai_secret', {
    p_user: userId,
    p_provider: PROVIDER,
    p_key: key,
    p_last4: key.slice(-4),
    p_model: model,
  });
  if (error) throw new Error(`AI 자격 증명 저장 실패: ${error.message}`);
}

/** Decrypt and return the user's Gemini key (server-side use only). Null if none. */
export async function getCredentialKey(userId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data, error } = await sb.rpc('get_ai_secret', {
    p_user: userId,
    p_provider: PROVIDER,
  });
  if (error) throw new Error(`AI 자격 증명 조회 실패: ${error.message}`);
  return (data as string | null) ?? null;
}

/** The stored model choice (Vault-independent metadata). */
export async function getCredentialModel(userId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from('user_ai_credentials')
    .select('model')
    .eq('user_id', userId)
    .eq('provider', PROVIDER)
    .maybeSingle();
  return (data as { model: string | null } | null)?.model ?? null;
}

/** Remove the Vault secret + the pointer row (disconnect). */
export async function deleteCredential(userId: string): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.rpc('delete_ai_secret', {
    p_user: userId,
    p_provider: PROVIDER,
  });
  if (error) throw new Error(`AI 연결 해제 실패: ${error.message}`);
}
