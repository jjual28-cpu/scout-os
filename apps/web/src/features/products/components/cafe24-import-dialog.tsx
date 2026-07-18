'use client';

import { Loader2, Package, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Status = { configured: boolean; connected: boolean; mallId: string | null };

type MallProduct = {
  productNo: number;
  name: string;
  price: number | null;
  imageUrl: string;
  status: '판매중' | '준비중';
  imported: boolean;
};

/**
 * 카페24 상품 임포트 다이얼로그. 상태에 따라 화면이 갈린다:
 *  - 미구성(configured=false): 오너가 카페24 앱 키를 설정해야 함 안내
 *  - 미연동: mall_id 입력 → OAuth 연동 시작
 *  - 연동됨: 상품 목록에서 몇 개 골라 임포트 (이미 가져온 건 비활성)
 */
export function Cafe24ImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [mallInput, setMallInput] = useState('');

  const [items, setItems] = useState<MallProduct[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);

  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  // 연동 상태 조회
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/cafe24/status');
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          setStatusError(json?.error?.message ?? '상태를 불러오지 못했어요.');
          return;
        }
        setStatus(json.data as Status);
      } catch {
        if (active) setStatusError('상태를 불러오지 못했어요.');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadPage = useCallback(async (offset: number) => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch(`/api/cafe24/products?offset=${offset}`);
      const json = await res.json();
      if (!res.ok) {
        setListError(json?.error?.message ?? '상품을 불러오지 못했어요.');
        return;
      }
      const page = json.data.products as MallProduct[];
      setItems((prev) => (offset === 0 ? page : [...prev, ...page]));
      setNextOffset(json.data.nextOffset ?? null);
    } catch {
      setListError('상품을 불러오지 못했어요.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  // 연동돼 있으면 첫 페이지 자동 로드
  useEffect(() => {
    if (status?.connected) void loadPage(0);
  }, [status?.connected, loadPage]);

  const connect = () => {
    const mall = mallInput.trim().toLowerCase();
    if (!mall) return;
    window.location.href = `/api/cafe24/authorize?mall_id=${encodeURIComponent(mall)}`;
  };

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return kw ? items.filter((p) => p.name.toLowerCase().includes(kw)) : items;
  }, [items, q]);

  const toggle = (no: number, disabled: boolean) => {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(no) ? next.delete(no) : next.add(no);
      return next;
    });
  };

  const runImport = async () => {
    if (!selected.size || importing) return;
    setImporting(true);
    setListError(null);
    try {
      const chosen = items.filter((p) => selected.has(p.productNo) && !p.imported);
      const res = await fetch('/api/cafe24/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: chosen.map((p) => ({
            productNo: p.productNo,
            name: p.name,
            price: p.price,
            imageUrl: p.imageUrl,
            status: p.status,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setListError(json?.error?.message ?? '임포트에 실패했어요.');
        return;
      }
      onImported(json.data.imported ?? chosen.length);
    } catch {
      setListError('임포트에 실패했어요.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="bg-card relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-base font-semibold">카페24에서 상품 가져오기</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-muted-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {statusError ? (
            <p className="text-destructive text-sm">{statusError}</p>
          ) : !status ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              불러오는 중…
            </div>
          ) : !status.configured ? (
            <div className="text-muted-foreground space-y-2 text-sm">
              <p className="text-foreground font-medium">카페24 연동이 아직 준비되지 않았어요.</p>
              <p>
                관리자가 카페24 개발자센터에서 앱을 등록하고 서버에 앱 키를 설정하면 이 화면에서
                상품을 가져올 수 있어요.
              </p>
            </div>
          ) : !status.connected ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                카페24 몰 아이디를 입력하고 연동하세요. 카페24 로그인·승인 화면으로 이동합니다.
              </p>
              <label className="block">
                <span className="text-muted-foreground mb-1 block text-xs font-medium">
                  카페24 몰 아이디 (mall_id)
                </span>
                <div className="flex gap-2">
                  <Input
                    value={mallInput}
                    onChange={(e) => setMallInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && connect()}
                    placeholder="예: yourmall (yourmall.cafe24.com 의 yourmall)"
                  />
                  <Button
                    type="button"
                    className="shrink-0"
                    onClick={connect}
                    disabled={!mallInput.trim()}
                  >
                    연동하기
                  </Button>
                </div>
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                  {status.mallId} 연동됨
                </span>
                가져올 상품을 선택하세요.
              </div>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="상품명 검색"
                  className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-lg border pl-8 pr-3 text-sm outline-none focus-visible:ring-2"
                />
              </div>

              {listError ? <p className="text-destructive text-sm">{listError}</p> : null}

              <div className="space-y-1.5">
                {filtered.map((p) => {
                  const on = selected.has(p.productNo);
                  return (
                    <button
                      key={p.productNo}
                      type="button"
                      onClick={() => toggle(p.productNo, p.imported)}
                      disabled={p.imported}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors',
                        p.imported
                          ? 'opacity-55'
                          : on
                            ? 'border-primary/40 bg-primary/5'
                            : 'dark:hover:bg-muted/50 hover:bg-slate-50/70',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                          on && !p.imported && 'border-primary bg-primary text-primary-foreground',
                        )}
                      >
                        {on && !p.imported ? '✓' : ''}
                      </span>
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- 카페24 이미지 URL
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="size-10 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                          <Package className="size-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {p.name || '(제목 없음)'}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {p.price != null ? `${p.price.toLocaleString('ko-KR')}원` : '가격 미정'}
                          {' · '}
                          {p.status}
                        </span>
                      </span>
                      {p.imported ? (
                        <span className="text-muted-foreground shrink-0 text-[11px]">가져옴</span>
                      ) : null}
                    </button>
                  );
                })}

                {loadingList ? (
                  <div className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    불러오는 중…
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    표시할 상품이 없어요.
                  </p>
                ) : null}

                {nextOffset != null && !loadingList ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => void loadPage(nextOffset)}
                  >
                    더 보기
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {status?.connected ? (
          <div className="flex items-center justify-between gap-2 border-t p-4">
            <span className="text-muted-foreground text-sm">{selected.size}개 선택</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                취소
              </Button>
              <Button onClick={() => void runImport()} disabled={!selected.size || importing}>
                {importing ? '가져오는 중…' : `선택 항목 가져오기`}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
