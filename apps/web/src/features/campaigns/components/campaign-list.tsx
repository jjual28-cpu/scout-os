'use client';

import { Package, Search, Star, Tag } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { keywordEmoji } from '@/features/search/keyword';

import { useCampaigns } from '../hooks/use-campaigns';
import { LABEL_META } from '../label';
import { type Campaign } from '../types';

function relativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const s = Math.floor((Date.now() - then) / 1000);
    if (s < 60) return '방금 전';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}일 전`;
    return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <span className={cn('text-sm font-semibold tabular-nums', accent && 'text-primary')}>
        {value}
      </span>
    </div>
  );
}

function CampaignRow({
  c,
  onToggleFavorite,
}: {
  c: Campaign;
  onToggleFavorite: (id: string) => void;
}) {
  const meta = LABEL_META[c.label];
  return (
    <div className="bg-card hover:border-primary/30 relative flex items-stretch gap-3 rounded-xl border p-4 transition-colors">
      <button
        type="button"
        onClick={() => onToggleFavorite(c.id)}
        className={cn(
          'mt-0.5 shrink-0 rounded p-1 transition-colors',
          c.favorite ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-amber-500',
        )}
        aria-label={c.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
        aria-pressed={c.favorite}
      >
        <Star className={cn('size-4', c.favorite && 'fill-current')} />
      </button>

      <Link href={`/campaigns/${c.id}`} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg">{keywordEmoji(c.query)}</span>
          <span className="truncate text-base font-semibold">{c.title}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', meta.className)}>
            {meta.emoji} {meta.label}
          </span>
        </div>

        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span>{c.platform}</span>
          <span>· {relativeTime(c.createdAt)}</span>
          {c.brand ? (
            <span className="inline-flex items-center gap-1">
              <Tag className="size-3" />
              {c.brand}
            </span>
          ) : null}
          {c.productName ? (
            <span className="inline-flex items-center gap-1">
              <Package className="size-3" />
              {c.productName}
            </span>
          ) : null}
          {c.season ? <span>· {c.season}</span> : null}
        </div>

        {c.status === 'failed' ? (
          <p className="text-destructive mt-2 truncate text-xs">
            검색 실패: {c.error ?? '알 수 없음'}
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
            <Stat label="검색" value={c.summary.discovered} accent />
            <Stat label="저장" value={c.summary.saved} />
            <Stat label="DM" value={c.summary.dm} />
            <Stat label="답변" value={c.summary.reply} />
            <Stat label="협업" value={c.summary.collab} />
            <Stat label="전환율" value={`${c.summary.conversion}%`} />
          </div>
        )}
      </Link>

      {c.lastAction ? (
        <div className="text-muted-foreground hidden w-28 shrink-0 flex-col items-end justify-center text-right text-xs sm:flex">
          <span>{relativeTime(c.lastAction.at)}</span>
          <span className="text-foreground font-medium">{c.lastAction.label}</span>
        </div>
      ) : null}
    </div>
  );
}

export function CampaignList() {
  const { campaigns, hydrated, toggleFavorite } = useCampaigns();
  const favorites = campaigns.filter((c) => c.favorite);
  const rest = campaigns.filter((c) => !c.favorite);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">캠페인</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        검색 기록과 크리에이터 진행 현황을 관리합니다.
      </p>

      <div className="mt-6 space-y-4">
        {!hydrated ? (
          <>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </>
        ) : campaigns.length === 0 ? (
          <div className="text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
            아직 캠페인이 없어요. 검색을 실행하면 캠페인이 만들어집니다.
            <div className="mt-3">
              <Button asChild>
                <Link href="/discover">
                  <Search className="size-4" />
                  검색하러 가기
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {favorites.length > 0 ? (
              <div className="space-y-2">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                  <Star className="size-3.5 fill-amber-500 text-amber-500" />
                  즐겨찾기
                </p>
                {favorites.map((c) => (
                  <CampaignRow key={c.id} c={c} onToggleFavorite={toggleFavorite} />
                ))}
              </div>
            ) : null}
            {rest.length > 0 ? (
              <div className="space-y-2">
                {favorites.length > 0 ? (
                  <p className="text-muted-foreground text-xs font-medium">전체</p>
                ) : null}
                {rest.map((c) => (
                  <CampaignRow key={c.id} c={c} onToggleFavorite={toggleFavorite} />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
