export type ProductStatus = '판매중' | '준비중' | '품절' | '중지';
export const PRODUCT_STATUSES: ProductStatus[] = ['판매중', '준비중', '품절', '중지'];

export type CollabType = '제품제공' | '수익쉐어' | '게런티' | '협의';
export const COLLAB_TYPES: CollabType[] = ['제품제공', '수익쉐어', '게런티', '협의'];

/** Split a comma-separated field into trimmed, de-duplicated tokens. */
export function splitTokens(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
}

/** A brand product. Fields feed the AI Engine's keyword + creator recommendations. */
export type Product = {
  id: string;
  /** AI Engine reference code, unique per user (e.g. VNT001). */
  productCode: string;
  /** Whether this product is included in search / AI. */
  isActive: boolean;
  name: string;
  brand: string;
  category: string;
  imageUrl: string;
  status: ProductStatus;
  price: number | null;
  commission: number | null; // 수수료 (%)
  revenueSharePct: number | null; // 기본 수익쉐어율 (%)
  /** One or more collab types, comma-separated (제품제공/수익쉐어/게런티/협의). */
  collabType: string;
  usp: string;
  sellingPoints: string;
  bannedPhrases: string;
  collabTerms: string;
  target: string;
  /** Recommended keywords, comma-separated (edited as tags; used by AI Engine). */
  recommendedKeywords: string;
  /** AI product analysis (filled by the AI Engine step; empty for now). */
  analysis?: string | null;
  /** Which engine produced the analysis (e.g. 'rule' | 'openai'). */
  analysisSource?: string | null;
  analysisUpdatedAt?: string | null;
  updatedAt?: string;
};

/**
 * Auto-generate a unique product code. Prefix = up to 3 latin letters/digits from
 * brand (or name), else 'PRD'; sequence = next number not already used.
 */
export function generateProductCode(existing: string[], brand?: string, name?: string): string {
  const src = (brand || name || '').toUpperCase();
  const latin = (src.match(/[A-Z0-9]/g) ?? []).join('');
  const prefix = (latin.slice(0, 3) || 'PRD').padEnd(3, 'X');
  const used = new Set(existing.filter(Boolean));
  let n = 1;
  let code = `${prefix}${String(n).padStart(3, '0')}`;
  while (used.has(code)) code = `${prefix}${String(++n).padStart(3, '0')}`;
  return code;
}

/** A blank product for the create form. */
export function emptyProduct(id: string): Product {
  return {
    id,
    productCode: '',
    isActive: true,
    name: '',
    brand: '',
    category: '',
    imageUrl: '',
    status: '준비중',
    price: null,
    commission: null,
    revenueSharePct: null,
    collabType: '',
    usp: '',
    sellingPoints: '',
    bannedPhrases: '',
    collabTerms: '',
    target: '',
    recommendedKeywords: '',
    analysis: null,
    analysisSource: null,
    analysisUpdatedAt: null,
  };
}
