'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

import { type Product } from '../types';

const KEY = 'scout:products';

/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows are loosely typed */
function rowToProduct(r: any): Product {
  return {
    id: r.id,
    productCode: r.product_code ?? '',
    isActive: r.is_active ?? true,
    name: r.name ?? '',
    brand: r.brand ?? '',
    category: r.category ?? '',
    imageUrl: r.image_url ?? '',
    status: r.status ?? '준비중',
    price: r.price ?? null,
    commission: r.commission ?? null,
    revenueSharePct: r.revenue_share_pct ?? null,
    collabType: r.collab_type ?? '',
    usp: r.usp ?? '',
    sellingPoints: r.selling_points ?? '',
    bannedPhrases: r.banned_phrases ?? '',
    collabTerms: r.collab_terms ?? '',
    target: r.target ?? '',
    recommendedKeywords: r.recommended_keywords ?? '',
    competitorHandles: r.competitor_handles ?? '',
    analysis: r.analysis ?? null,
    analysisSource: r.analysis_source ?? null,
    analysisUpdatedAt: r.analysis_updated_at ?? null,
    source: r.source ?? null,
    sourceProductNo: r.source_product_no ?? null,
    updatedAt: r.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function productToRow(p: Product, uid: string) {
  return {
    id: p.id,
    user_id: uid,
    product_code: p.productCode || null,
    is_active: p.isActive,
    name: p.name,
    brand: p.brand || null,
    category: p.category || null,
    image_url: p.imageUrl || null,
    status: p.status,
    price: p.price,
    commission: p.commission,
    revenue_share_pct: p.revenueSharePct,
    collab_type: p.collabType || null,
    usp: p.usp || null,
    selling_points: p.sellingPoints || null,
    banned_phrases: p.bannedPhrases || null,
    collab_terms: p.collabTerms || null,
    target: p.target || null,
    recommended_keywords: p.recommendedKeywords || null,
    competitor_handles: p.competitorHandles || null,
    analysis: p.analysis ?? null,
    analysis_source: p.analysisSource ?? null,
    analysis_updated_at: p.analysisUpdatedAt ?? null,
    source: p.source ?? null,
    source_product_no: p.sourceProductNo ?? null,
  };
}

function readLocal(): Product[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Product[]) : [];
  } catch {
    return [];
  }
}
function writeLocal(list: Product[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/**
 * Product CRUD backed by Supabase (`products`, RLS) when configured + signed in,
 * else localStorage (mock mode). Mutations are optimistic and roll back on
 * failure, surfacing a Korean error.
 */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = useRef<'local' | 'supabase'>('local');
  const userId = useRef<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured()) {
      mode.current = 'local';
      setProducts(readLocal());
      setHydrated(true);
      return;
    }
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        mode.current = 'local';
        setProducts(readLocal());
        setHydrated(true);
        return;
      }
      mode.current = 'supabase';
      userId.current = user.id;
      const { data } = await sb
        .from('products')
        .select('*')
        .order('updated_at', { ascending: false });
      setProducts((data ?? []).map(rowToProduct));
      setHydrated(true);
    } catch {
      mode.current = 'local';
      setProducts(readLocal());
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async (product: Product): Promise<boolean> => {
    setError(null);
    setProducts((prev) => [product, ...prev]);
    if (mode.current === 'local') {
      setProducts((prev) => {
        writeLocal(prev);
        return prev;
      });
      return true;
    }
    try {
      const { error: e } = await createClient()
        .from('products')
        .insert(productToRow(product, userId.current!));
      if (e) throw e;
      return true;
    } catch {
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setError('상품 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
      return false;
    }
  }, []);

  const update = useCallback(async (id: string, patch: Partial<Product>): Promise<boolean> => {
    setError(null);
    let prevItem: Product | undefined;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        prevItem = p;
        return { ...p, ...patch };
      }),
    );
    if (mode.current === 'local') {
      setProducts((prev) => {
        writeLocal(prev);
        return prev;
      });
      return true;
    }
    try {
      const merged = { ...(prevItem as Product), ...patch };
      const { error: e } = await createClient()
        .from('products')
        .update(productToRow(merged, userId.current!))
        .eq('id', id);
      if (e) throw e;
      return true;
    } catch {
      if (prevItem)
        setProducts((prev) => prev.map((p) => (p.id === id ? (prevItem as Product) : p)));
      setError('상품 수정에 실패했어요. 잠시 후 다시 시도해 주세요.');
      return false;
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    let removed: Product | undefined;
    setProducts((prev) => {
      removed = prev.find((p) => p.id === id);
      return prev.filter((p) => p.id !== id);
    });
    if (mode.current === 'local') {
      setProducts((prev) => {
        writeLocal(prev);
        return prev;
      });
      return true;
    }
    try {
      const { error: e } = await createClient().from('products').delete().eq('id', id);
      if (e) throw e;
      return true;
    } catch {
      if (removed) setProducts((prev) => [removed as Product, ...prev]);
      setError('상품 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.');
      return false;
    }
  }, []);

  return {
    products,
    hydrated,
    error,
    clearError: () => setError(null),
    create,
    update,
    remove,
    reload: load,
  };
}
