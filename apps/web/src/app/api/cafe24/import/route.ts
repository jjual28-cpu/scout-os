import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { generateProductCode } from '@/features/products/types';
import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

const bodySchema = z.object({
  products: z
    .array(
      z.object({
        productNo: z.number().int(),
        name: z.string().max(300),
        price: z.number().nullable().optional(),
        imageUrl: z.string().max(2000).optional(),
        status: z.enum(['판매중', '준비중']).optional(),
      }),
    )
    .min(1)
    .max(200),
});

/**
 * POST /api/cafe24/import — 선택한 카페24 상품을 products 로 임포트한다(핵심 필드만).
 * 이미 임포트된 카페24 상품(source_product_no)은 건너뛴다. product_code 는 자동 생성.
 * RLS 클라이언트로 본인 행만 insert. Auth 필요. → { imported, skipped }
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '서버가 구성되지 않았습니다.', 503);

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  const { products } = bodySchema.parse(await request.json());

  // 기존 상품에서 (a) 이미 임포트된 카페24 번호, (b) 사용중인 product_code 수집.
  const { data: existingRows } = await sb
    .from('products')
    .select('product_code, source, source_product_no');
  const importedSet = new Set(
    (existingRows ?? [])
      .filter((r: { source: string | null }) => r.source === 'cafe24')
      .map((r: { source_product_no: string | null }) => r.source_product_no)
      .filter((v): v is string => Boolean(v)),
  );
  const usedCodes = (existingRows ?? [])
    .map((r: { product_code: string | null }) => r.product_code)
    .filter((v): v is string => Boolean(v));

  // 배치 내 중복 제거 + 이미 임포트된 것 제외.
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const p of products) {
    const key = String(p.productNo);
    if (importedSet.has(key) || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const code = generateProductCode(usedCodes, undefined, p.name);
    usedCodes.push(code);
    rows.push({
      user_id: userId,
      product_code: code,
      is_active: true,
      name: p.name || '(제목 없음)',
      image_url: p.imageUrl || null,
      status: p.status ?? '준비중',
      price: p.price ?? null,
      source: 'cafe24',
      source_product_no: key,
    });
  }

  if (rows.length === 0) return ok({ imported: 0, skipped });

  const { error } = await sb.from('products').insert(rows);
  if (error) throw new Error(`상품 임포트 실패: ${error.message}`);

  return ok({ imported: rows.length, skipped });
});
