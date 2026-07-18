import { type NextRequest } from 'next/server';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isCafe24Configured, isSupabaseConfigured } from '@/lib/env';
import { fetchProducts } from '@/services/cafe24/products';
import { getValidAccessToken } from '@/services/cafe24/oauth';

export const dynamic = 'force-dynamic';

const PAGE = 100;

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * GET /api/cafe24/products?offset=… — 연동된 몰의 상품 한 페이지.
 * 이미 임포트한 상품(products.source='cafe24')은 imported:true 로 표시해
 * 다이얼로그에서 회색·재임포트 방지. Auth 필요.
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  if (!isSupabaseConfigured() || !isCafe24Configured()) {
    return fail('UNAVAILABLE', '카페24가 구성되지 않았습니다.', 503);
  }

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  const token = await getValidAccessToken(userId);
  if (!token) return fail('CAFE24_NOT_CONNECTED', '카페24가 연동되지 않았습니다.', 409);

  const offsetRaw = Number(new URL(request.url).searchParams.get('offset') ?? '0');
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;

  const products = await fetchProducts(token.mallId, token.accessToken, { limit: PAGE, offset });

  // 이미 임포트된 카페24 상품번호 집합 (RLS: 본인 것만).
  const { data: existing } = await sb
    .from('products')
    .select('source_product_no')
    .eq('source', 'cafe24');
  const importedSet = new Set(
    (existing ?? [])
      .map((r: { source_product_no: string | null }) => r.source_product_no)
      .filter((v): v is string => Boolean(v)),
  );

  const items = products.map((p) => ({
    ...p,
    imported: importedSet.has(String(p.productNo)),
  }));

  return ok({
    products: items,
    nextOffset: products.length === PAGE ? offset + PAGE : null,
  });
});
