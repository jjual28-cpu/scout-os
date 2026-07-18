import { type NextRequest } from 'next/server';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isCafe24Configured, isSupabaseConfigured } from '@/lib/env';
import { fetchProductsByNo } from '@/services/cafe24/products';
import { getValidAccessToken } from '@/services/cafe24/oauth';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/cafe24/refresh — 카페24에서 가져온 상품들의 현재 가격·상태·이미지를
 * 다시 불러와 갱신한다. 바뀐 것만 업데이트(가격/상태/이미지). RLS 클라이언트로
 * 본인 행만. Auth 필요. → { checked, updated }
 */
export const POST = withErrorHandling(async (_request: NextRequest) => {
  if (!isSupabaseConfigured() || !isCafe24Configured()) {
    return fail('UNAVAILABLE', '카페24가 구성되지 않았습니다.', 503);
  }

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  const token = await getValidAccessToken(userId);
  if (!token) return fail('CAFE24_NOT_CONNECTED', '카페24가 연동되지 않았습니다.', 409);

  // 카페24에서 가져온 본인 상품들 (RLS).
  const { data: rows } = await sb
    .from('products')
    .select('id, source_product_no, price, status, image_url')
    .eq('source', 'cafe24');
  const mine = (rows ?? []).filter(
    (r: { source_product_no: string | null }) => r.source_product_no,
  ) as {
    id: string;
    source_product_no: string;
    price: number | null;
    status: string;
    image_url: string | null;
  }[];

  if (mine.length === 0) return ok({ checked: 0, updated: 0 });

  const fresh = await fetchProductsByNo(
    token.mallId,
    token.accessToken,
    mine.map((m) => Number(m.source_product_no)),
  );
  const byNo = new Map(fresh.map((p) => [String(p.productNo), p]));

  let updated = 0;
  for (const row of mine) {
    const f = byNo.get(row.source_product_no);
    if (!f) continue;
    const patch: Record<string, unknown> = {};
    if (f.price != null && f.price !== row.price) patch.price = f.price;
    if (f.status !== row.status) patch.status = f.status;
    if (f.imageUrl && f.imageUrl !== row.image_url) patch.image_url = f.imageUrl;
    if (Object.keys(patch).length === 0) continue;
    const { error } = await sb.from('products').update(patch).eq('id', row.id);
    if (!error) updated++;
  }

  return ok({ checked: mine.length, updated });
});
