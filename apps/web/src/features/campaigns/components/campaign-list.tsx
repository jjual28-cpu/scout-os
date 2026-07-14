'use client';

import { Search, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/layout/blocks';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useCampaigns } from '../hooks/use-campaigns';
import { LABEL_META } from '../label';
import { type Campaign } from '../types';

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

function Row({ c, onToggleFavorite }: { c: Campaign; onToggleFavorite: (id: string) => void }) {
  const router = useRouter();
  const meta = LABEL_META[c.label];
  return (
    <tr
      onClick={() => router.push(`/campaigns/${c.id}`)}
      className="dark:border-border/60 dark:hover:bg-muted/40 cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70"
    >
      <td className="py-3 pl-4 pr-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(c.id);
          }}
          className={cn(
            'rounded p-0.5 transition-colors',
            c.favorite
              ? 'text-amber-500'
              : 'dark:text-muted-foreground text-slate-300 hover:text-amber-500',
          )}
          aria-label={c.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
          aria-pressed={c.favorite}
        >
          <Star className={cn('size-4', c.favorite && 'fill-current')} />
        </button>
      </td>
      <td className="max-w-[220px] py-3 pr-4">
        <p className="truncate font-medium">{c.title}</p>
        <p className="dark:text-muted-foreground truncate text-xs text-slate-400">{c.query}</p>
      </td>
      <td className="py-3 pr-4">
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', meta.className)}>
          {meta.label}
        </span>
      </td>
      <td className="dark:text-muted-foreground hidden max-w-[140px] py-3 pr-4 text-slate-500 lg:table-cell">
        <span className="block truncate">{c.productName ?? '—'}</span>
      </td>
      <td className="py-3 pr-4 text-right tabular-nums">{c.summary.discovered}</td>
      <td className="hidden py-3 pr-4 text-right tabular-nums sm:table-cell">{c.summary.dm}</td>
      <td className="hidden py-3 pr-4 text-right tabular-nums sm:table-cell">{c.summary.reply}</td>
      <td className="py-3 pr-4 text-right tabular-nums">
        <span className={cn(c.summary.conversion > 0 && 'text-primary font-medium')}>
          {c.summary.conversion}%
        </span>
      </td>
      <td className="dark:text-muted-foreground hidden py-3 pr-4 text-right text-slate-400 md:table-cell">
        {fmtDate(c.createdAt)}
      </td>
    </tr>
  );
}

export function CampaignList() {
  const { campaigns, hydrated, toggleFavorite } = useCampaigns();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="캠페인"
        description="검색 세션과 셀럽 협업 진행 현황을 한곳에서 관리합니다."
        actions={
          <Button asChild>
            <Link href="/discover">
              <Search className="size-4" />새 검색
            </Link>
          </Button>
        }
      />

      {!hydrated ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title="아직 캠페인이 없어요"
          description="셀럽을 검색하면 캠페인이 자동으로 만들어집니다."
          action={
            <Button asChild size="sm">
              <Link href="/discover">
                <Search className="size-4" />
                검색하러 가기
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="dark:border-border overflow-x-auto rounded-xl border border-slate-200/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="dark:border-border dark:text-muted-foreground border-b border-slate-200/60 text-left text-xs text-slate-400">
                <th className="py-2.5 pl-4 pr-1"></th>
                <th className="py-2.5 pr-4 font-medium">캠페인</th>
                <th className="py-2.5 pr-4 font-medium">상태</th>
                <th className="hidden py-2.5 pr-4 font-medium lg:table-cell">상품</th>
                <th className="py-2.5 pr-4 text-right font-medium">셀럽</th>
                <th className="hidden py-2.5 pr-4 text-right font-medium sm:table-cell">DM</th>
                <th className="hidden py-2.5 pr-4 text-right font-medium sm:table-cell">답변</th>
                <th className="py-2.5 pr-4 text-right font-medium">전환율</th>
                <th className="hidden py-2.5 pr-4 text-right font-medium md:table-cell">생성일</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <Row key={c.id} c={c} onToggleFavorite={toggleFavorite} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
