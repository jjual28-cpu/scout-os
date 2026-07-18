'use client';

import { ArrowRight, Loader2, Package, Search, Sparkles, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/features/products/hooks/use-products';
import { splitTokens } from '@/features/products/types';
import { cn } from '@/lib/utils';

/**
 * "AI 직원" — the guided entry point. Pick a product, let the AI propose the
 * search keywords that fit it, and launch a celeb search in one click. It ties
 * together the pieces (product data, AI planning, the campaign search, and the
 * per-creator AI DM in Discover) so the user doesn't have to wire them by hand.
 */
export function AiEmployeePage() {
  const { products, hydrated } = useProducts();
  const router = useRouter();

  const [productId, setProductId] = useState<string>('');
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);
  const reqId = useRef(0);

  const product = products.find((p) => p.id === productId) ?? null;
  const savedKeywords = product ? splitTokens(product.recommendedKeywords) : [];

  // Ask the AI for keywords whenever the chosen product changes.
  useEffect(() => {
    if (!product) {
      setAiKeywords([]);
      setError(null);
      return;
    }
    const my = ++reqId.current;
    setLoading(true);
    setError(null);
    setAiKeywords([]);
    (async () => {
      try {
        const res = await fetch('/api/ai/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product: {
              name: product.name,
              brand: product.brand,
              category: product.category,
              usp: product.usp,
              sellingPoints: product.sellingPoints,
              target: product.target,
            },
          }),
        });
        const json = (await res.json().catch(() => null)) as {
          data?: { keywords?: string[] };
          error?: { message?: string };
        } | null;
        if (my !== reqId.current) return;
        const kws = json?.data?.keywords ?? [];
        if (!res.ok || kws.length === 0) {
          setError(
            json?.error?.message ??
              'AI 키워드 추천을 못 받았어요. 아래 저장된 추천 키워드로 검색할 수 있어요.',
          );
        }
        setAiKeywords(kws);
      } catch {
        if (my !== reqId.current) return;
        setError('AI 키워드 추천 중 문제가 생겼어요. 저장된 추천 키워드로 검색해 보세요.');
      } finally {
        if (my === reqId.current) setLoading(false);
      }
    })();
  }, [product]);

  async function launch(keyword: string) {
    if (launching) return;
    setLaunching(keyword);
    try {
      const res = await fetch('/api/discover/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: keyword, productId, source: 'ai', target: 'creator' }),
      });
      // Any resolved response → hand off to Discover, which opens the running
      // (or mock) search. Mock mode returns configured:false and that's fine.
      await res.json().catch(() => null);
      router.push('/discover');
    } catch {
      setLaunching(null);
      setError('검색을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  const KeywordChip = ({ kw }: { kw: string }) => (
    <button
      type="button"
      disabled={Boolean(launching)}
      onClick={() => void launch(kw)}
      className={cn(
        'border-input bg-background hover:border-primary/50 hover:bg-primary/5 group inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors disabled:pointer-events-none disabled:opacity-50',
        launching === kw && 'border-primary/60 bg-primary/10',
      )}
    >
      {launching === kw ? (
        <Loader2 className="text-primary size-3.5 animate-spin" />
      ) : (
        <Search className="text-muted-foreground group-hover:text-primary size-3.5" />
      )}
      {kw}
      <ArrowRight className="text-muted-foreground group-hover:text-primary size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="AI 직원"
        description="상품을 고르면 AI가 검색 키워드를 추천하고, 한 번의 클릭으로 셀럽을 찾아줍니다."
      />

      {!hydrated ? (
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      ) : products.length === 0 ? (
        <div className="bg-card dark:border-border rounded-2xl border border-slate-200/60 p-8 text-center">
          <Package className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">먼저 상품을 등록하세요</p>
          <p className="text-muted-foreground mt-1 text-sm">
            AI가 상품 정보를 읽고 어울리는 셀럽을 찾아줍니다.
          </p>
          <Button asChild className="mt-4">
            <Link href="/products">상품 등록하러 가기</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Step 1 — pick a product */}
          <section className="bg-card dark:border-border rounded-2xl border border-slate-200/60 p-6">
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs font-bold">
                1
              </span>
              <h2 className="text-sm font-semibold">어떤 상품으로 셀럽을 찾을까요?</h2>
            </div>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="border-input bg-background focus-visible:ring-ring mt-3 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus-visible:ring-2"
            >
              <option value="">상품을 선택하세요</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || '(이름 없음)'}
                  {p.brand ? ` · ${p.brand}` : ''}
                </option>
              ))}
            </select>
          </section>

          {/* Step 2 — AI keywords */}
          {product ? (
            <section className="bg-card dark:border-border rounded-2xl border border-slate-200/60 p-6">
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs font-bold">
                  2
                </span>
                <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles className="text-primary size-4" />
                  AI 추천 키워드
                </h2>
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs">
                키워드를 누르면 그 주제의 셀럽을 바로 찾기 시작해요 (상품 정보가 함께 반영돼요).
              </p>

              {loading ? (
                <div className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  AI가 이 상품에 맞는 키워드를 뽑는 중…
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {aiKeywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {aiKeywords.map((kw) => (
                        <KeywordChip key={kw} kw={kw} />
                      ))}
                    </div>
                  ) : null}

                  {error ? (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  {savedKeywords.length > 0 ? (
                    <div>
                      <p className="text-muted-foreground mb-1.5 text-xs">상품에 저장된 키워드</p>
                      <div className="flex flex-wrap gap-2">
                        {savedKeywords.map((kw) => (
                          <KeywordChip key={`saved-${kw}`} kw={kw} />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {aiKeywords.length === 0 && savedKeywords.length === 0 && !error ? (
                    <p className="text-muted-foreground text-sm">
                      추천할 키워드가 없어요. 상품 정보(카테고리·타겟)를 채우면 더 정확해져요.
                    </p>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
