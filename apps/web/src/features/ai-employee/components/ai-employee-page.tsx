'use client';

import {
  ArrowRight,
  ChevronDown,
  Instagram,
  Loader2,
  Music2,
  Package,
  Search,
  Sparkles,
  TriangleAlert,
  Youtube,
} from 'lucide-react';
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
/** 검색 플랫폼 — 셀럽 찾기 페이지와 동일한 3택. instagram 기본. */
const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'tiktok', label: 'TikTok', icon: Music2 },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
] as const;
type PlatformId = (typeof PLATFORMS)[number]['id'];

export function AiEmployeePage() {
  const { products, hydrated } = useProducts();
  const router = useRouter();

  const [productId, setProductId] = useState<string>('');
  const [platform, setPlatform] = useState<PlatformId>('instagram');
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);
  const [customKw, setCustomKw] = useState('');
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
      const body: Record<string, unknown> = {
        query: keyword,
        productId,
        source: 'ai',
        target: 'creator',
      };
      // 틱톡·유튜브만 platform 전송(미지정=인스타). 태그 모드 없는 단일 스테이지 검색.
      if (platform !== 'instagram') body.platform = platform;
      const res = await fetch('/api/discover/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { campaignId?: string | null };
      } | null;
      // 방금 시작한 검색을 Discover가 바로 열도록 campaign id 를 넘긴다. 안 넘기면
      // Discover 가 이전에 보던 캠페인을 열어 "검색이 안 된 것"처럼 보인다.
      // campaignId 가 없으면(모의/로그아웃) 그냥 Discover 로.
      const campaignId = json?.data?.campaignId ?? null;
      router.push(campaignId ? `/discover?campaign=${campaignId}` : '/discover');
    } catch {
      setLaunching(null);
      setError('검색을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  function submitCustom() {
    const kw = customKw.trim();
    if (!kw || launching) return;
    void launch(kw);
  }

  /** AI가 알아서 — 이 상품에 가장 맞는 검색어(AI 1순위)로 바로 셀럽 검색을 시작한다. */
  async function autoFind() {
    if (!product || launching) return;
    const term =
      aiKeywords[0] || savedKeywords[0] || product.category.trim() || product.name.trim();
    if (!term) {
      setError('상품 정보가 부족해요. 상품에 카테고리를 채우면 AI가 더 잘 찾아요.');
      return;
    }
    await launch(term);
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
        description="상품만 고르면 AI가 알아서 어울리는 셀럽을 찾아줍니다."
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

          {/* Step 2 — AI가 알아서 셀럽 찾기 */}
          {product ? (
            <section className="bg-card dark:border-border rounded-2xl border border-slate-200/60 p-6">
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs font-bold">
                  2
                </span>
                <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles className="text-primary size-4" />
                  AI가 어울리는 셀럽 찾기
                </h2>
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs">
                상품에 맞는 셀럽을 AI가 알아서 찾아드려요. 버튼만 누르면 검색이 시작돼요.
              </p>

              {/* 플랫폼 선택 — 어느 SNS에서 셀럽을 찾을지 (인스타/틱톡/유튜브) */}
              <div className="mt-4">
                <p className="text-muted-foreground mb-1.5 text-xs">어디에서 찾을까요?</p>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const Icon = p.icon;
                    const active = platform === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlatform(p.id)}
                        disabled={Boolean(launching)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input bg-background hover:border-primary/50 hover:bg-primary/5',
                        )}
                      >
                        <Icon className="size-4" />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary — AI 자동 검색 */}
              <Button
                type="button"
                size="lg"
                className="mt-4 w-full"
                onClick={() => void autoFind()}
                disabled={Boolean(launching) || loading}
              >
                {launching ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    셀럽을 찾는 중…
                  </>
                ) : loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    AI가 상품을 분석하는 중…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    AI가 어울리는 셀럽 찾기
                  </>
                )}
              </Button>
              {!loading && !launching && aiKeywords[0] ? (
                <p className="text-muted-foreground mt-2 text-center text-xs">
                  AI가 고른 검색어:{' '}
                  <span className="text-foreground font-medium">{aiKeywords[0]}</span>
                </p>
              ) : null}

              {error ? (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              {/* Secondary — 직접 검색어를 고르고 싶은 사람만 (접힘) */}
              <details className="dark:border-border group mt-5 border-t border-slate-200/60 pt-4">
                <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium">
                  <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                  직접 검색어를 고르고 싶다면
                </summary>

                <div className="mt-3 space-y-4">
                  {/* 직접 입력 */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                      <input
                        value={customKw}
                        onChange={(e) => setCustomKw(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitCustom();
                          }
                        }}
                        disabled={Boolean(launching)}
                        placeholder="직접 키워드 입력 (예: 구강청결제)"
                        className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-lg border pl-8 pr-3 text-sm outline-none focus-visible:ring-2 disabled:opacity-50"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={submitCustom}
                      disabled={!customKw.trim() || Boolean(launching)}
                      className="shrink-0"
                    >
                      {launching === customKw.trim() ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Search className="size-4" />
                      )}
                      찾기
                    </Button>
                  </div>

                  {/* AI 추천 키워드 · 저장된 키워드 (선택) */}
                  {aiKeywords.length > 0 ? (
                    <div>
                      <p className="text-muted-foreground mb-1.5 text-xs">AI 추천 키워드</p>
                      <div className="flex flex-wrap gap-2">
                        {aiKeywords.map((kw) => (
                          <KeywordChip key={kw} kw={kw} />
                        ))}
                      </div>
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
                </div>
              </details>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
