'use client';

import { ExternalLink, Music2, RefreshCw, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn, formatCompactNumber } from '@/lib/utils';

/** 서버 랭킹 1건(readTrends 반환 형태). */
type Row = {
  audioKey: string;
  songName: string | null;
  artistName: string | null;
  usesOriginal: boolean;
  reelCount: number;
  totalViews: number;
  maxViews: number;
  avgViews: number;
  sampleReels: { url: string; views: number; owner: string | null }[];
  risePct: number | null;
  isNew: boolean;
};

const SCOPES = ['전체', '뷰티', '패션', '여행', '맛집', '운동', '카페', '육아'];
type Tab = 'used' | 'views' | 'rising';
const TABS: { id: Tab; label: string }[] = [
  { id: 'used', label: '많이 쓴 음원' },
  { id: 'views', label: '고조회 음원' },
  { id: 'rising', label: '급상승' },
];

function sortRows(rows: Row[], tab: Tab): Row[] {
  const arr = [...rows];
  if (tab === 'used') arr.sort((a, b) => b.reelCount - a.reelCount || b.maxViews - a.maxViews);
  else if (tab === 'views')
    arr.sort((a, b) => b.maxViews - a.maxViews || b.reelCount - a.reelCount);
  else
    arr.sort((a, b) => {
      const sa = a.isNew ? 100000 : (a.risePct ?? -1);
      const sb = b.isNew ? 100000 : (b.risePct ?? -1);
      return sb - sa || b.reelCount - a.reelCount;
    });
  return arr.slice(0, 40);
}

export function AudioTrends() {
  const [scope, setScope] = useState('전체');
  const [tab, setTab] = useState<Tab>('used');
  const [rows, setRows] = useState<Row[]>([]);
  const [capturedOn, setCapturedOn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  /** 저장된 랭킹 읽기(스크랩 안 함). */
  const load = useCallback(async (s: string) => {
    const my = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trends/audio?scope=${encodeURIComponent(s)}`);
      const json = (await res.json().catch(() => null)) as {
        data?: { capturedOn: string | null; rows: Row[] };
      } | null;
      if (my !== reqId.current) return;
      setRows(json?.data?.rows ?? []);
      setCapturedOn(json?.data?.capturedOn ?? null);
    } catch {
      if (my !== reqId.current) return;
      setError('불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      if (my === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(scope);
  }, [scope, load]);

  /** 지금 갱신 — 릴스를 새로 긁어 음원 집계(스크랩 시작 → 완료까지 폴링). */
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const startRes = await fetch('/api/trends/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      const startJson = (await startRes.json().catch(() => null)) as {
        data?: { runId?: string; datasetId?: string };
      } | null;
      const runId = startJson?.data?.runId;
      const datasetId = startJson?.data?.datasetId;
      if (!runId) {
        setError('스크랩을 시작하지 못했어요.');
        setRefreshing(false);
        return;
      }
      // 완료까지 폴링(최대 ~4분).
      const startedAt = Date.now();
      while (Date.now() - startedAt < 240_000) {
        await new Promise((r) => setTimeout(r, 5000));
        const cRes = await fetch('/api/trends/audio/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId, datasetId, scope }),
        });
        const cJson = (await cRes.json().catch(() => null)) as {
          data?: { done?: boolean; failed?: boolean; rows?: Row[]; capturedOn?: string | null };
        } | null;
        const d = cJson?.data;
        if (d?.done) {
          if (d.failed) setError('스크랩이 실패했어요. 다시 시도해 주세요.');
          else {
            setRows(d.rows ?? []);
            setCapturedOn(d.capturedOn ?? null);
          }
          setRefreshing(false);
          return;
        }
      }
      setError('시간이 오래 걸려요. 잠시 후 다시 눌러 주세요.');
    } catch {
      setError('갱신 중 문제가 생겼어요.');
    } finally {
      setRefreshing(false);
    }
  }

  const visible = sortRows(rows, tab);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Music2 className="text-primary size-6" />
            트렌드 음원
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            릴스에서 지금 많이 쓰이는 · 조회수 높은 · 뜨고 있는 음원. (긁은 릴스 표본 기반 추정)
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
          {refreshing ? '긁는 중…' : '지금 갱신'}
        </Button>
      </div>

      {/* 분야 선택 */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {SCOPES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              scope === s
                ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                : 'dark:border-border dark:text-muted-foreground border-slate-200/70 text-slate-600',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* 탭 */}
      <div className="mb-4 flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors',
              tab === t.id
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.id === 'rising' ? <TrendingUp className="size-3.5" /> : null}
            {t.label}
          </button>
        ))}
      </div>

      {capturedOn ? (
        <p className="text-muted-foreground mb-3 text-xs">기준: {capturedOn} 스냅샷</p>
      ) : null}

      {error ? <p className="mb-3 text-sm text-rose-500">{error}</p> : null}

      {loading ? (
        <p className="text-muted-foreground py-16 text-center text-sm">불러오는 중…</p>
      ) : visible.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
          아직 이 분야 데이터가 없어요.
          <br />
          <span className="text-foreground font-medium">지금 갱신</span>을 눌러 릴스를 긁으면 음원이
          집계돼요. (급상승은 며칠 스냅샷이 쌓이면 나와요)
        </div>
      ) : (
        <ol className="space-y-2">
          {visible.map((r, i) => (
            <li
              key={r.audioKey}
              className="dark:border-border flex items-center gap-3 rounded-xl border border-slate-200/70 p-3"
            >
              <span className="text-muted-foreground w-6 text-center text-sm font-semibold">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {r.usesOriginal && !r.songName ? '오리지널 오디오' : r.songName || '(제목 미상)'}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {r.artistName || (r.usesOriginal ? '크리에이터 오리지널' : '아티스트 미상')}
                  {r.sampleReels[0]?.owner ? ` · @${r.sampleReels[0].owner}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <p className="text-sm font-semibold">{formatCompactNumber(r.reelCount)}</p>
                  <p className="text-muted-foreground text-[10px]">릴스</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{formatCompactNumber(r.maxViews)}</p>
                  <p className="text-muted-foreground text-[10px]">최고 조회</p>
                </div>
                {r.isNew ? (
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                    신규
                  </span>
                ) : r.risePct != null && r.risePct > 0 ? (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    ▲{r.risePct}%
                  </span>
                ) : (
                  <span className="w-10" />
                )}
                {r.sampleReels[0]?.url ? (
                  <a
                    href={r.sampleReels[0].url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-primary hover:bg-primary/10 rounded-lg p-1.5 transition-colors"
                    title="대표 릴스 보기"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
