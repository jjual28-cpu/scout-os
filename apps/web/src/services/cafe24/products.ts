import 'server-only';

/**
 * 카페24 Admin API 상품 조회 — 서버 전용. 핵심 필드만 정규화한다
 * (상품명·판매가·대표이미지·상태). 브랜드/카테고리는 카페24가 코드로만 주므로
 * 여기서 채우지 않는다(임포트 후 사용자가 상품 화면에서 채움).
 *
 * X-Cafe24-Api-Version 헤더는 일부러 보내지 않는다 — 보내면 특정 버전에 고정되어
 * 존재하지 않는 버전 문자열로 깨질 위험이 있어, 앱 개발자센터에 설정된 기본 버전을
 * 그대로 쓰게 둔다.
 */

export type Cafe24ProductStatus = '판매중' | '준비중';

export type Cafe24Product = {
  /** 카페24 product_no (중복 임포트 방지 키). */
  productNo: number;
  name: string;
  price: number | null;
  imageUrl: string;
  status: Cafe24ProductStatus;
};

/** 카페24 이미지 URL 은 종종 `//host/…` 형태 → https 로 보정. */
function normalizeImage(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  if (value.startsWith('//')) return `https:${value}`;
  return value;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- external API JSON */
function normalizeProduct(p: any): Cafe24Product | null {
  const productNo = Number(p?.product_no);
  if (!Number.isFinite(productNo)) return null;
  const selling = p?.selling === 'T';
  const display = p?.display === 'T';
  return {
    productNo,
    name: typeof p?.product_name === 'string' ? p.product_name : '',
    price: toNumber(p?.price) ?? toNumber(p?.retail_price),
    imageUrl: normalizeImage(p?.list_image) || normalizeImage(p?.detail_image),
    status: selling && display ? '판매중' : '준비중',
  };
}

/**
 * 상품 한 페이지를 가져온다(정규화). limit 최대 100, offset 페이지네이션.
 * 실패 시 throw (호출측이 사용자에게 오류 표시).
 */
export async function fetchProducts(
  mallId: string,
  accessToken: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Cafe24Product[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const url = new URL(`https://${mallId}.cafe24api.com/api/v2/admin/products`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  url.searchParams.set(
    'fields',
    'product_no,product_name,price,retail_price,list_image,detail_image,selling,display',
  );

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `카페24 상품 조회 오류 (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : '카페24 상품 조회에 실패했습니다.');
  }
  const arr: any[] = Array.isArray(json?.products) ? json.products : [];
  return arr.map(normalizeProduct).filter((p): p is Cafe24Product => p !== null);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
