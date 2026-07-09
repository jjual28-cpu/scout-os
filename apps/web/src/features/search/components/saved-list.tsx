'use client';

import { Bookmark } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useSavedOpportunities } from '../hooks/use-saved-opportunities';
import { FILTER_OPTIONS, type StatusFilter } from '../status';
import { SavedOpportunityCard } from './saved-opportunity-card';

export function SavedList() {
  const { saved, count, hydrated, setStatus, setNote, remove, clear } = useSavedOpportunities();
  const [filter, setFilter] = useState<StatusFilter>('전체');

  const countFor = (option: StatusFilter) =>
    option === '전체' ? saved.length : saved.filter((s) => s.status === option).length;

  const filtered = filter === '전체' ? saved : saved.filter((s) => s.status === filter);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">저장한 기회</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {hydrated ? `${count}개의 기회를 저장했습니다.` : ' '}
          </p>
        </div>
        {hydrated && count > 0 ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            전체 삭제
          </Button>
        ) : null}
      </div>

      {!hydrated ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-2xl" />
          ))}
        </div>
      ) : count === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* 상태 필터 */}
          <div className="mb-6 flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => {
              const active = filter === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(option)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {option}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-xs',
                      active ? 'bg-primary-foreground/20' : 'bg-muted',
                    )}
                  >
                    {countFor(option)}
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="text-muted-foreground rounded-2xl border border-dashed py-16 text-center text-sm">
              &lsquo;{filter}&rsquo; 상태의 기회가 없습니다.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <SavedOpportunityCard
                  key={item.id}
                  item={item}
                  onStatusChange={setStatus}
                  onNoteChange={setNote}
                  onRemove={remove}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
      <div className="bg-muted mb-4 flex size-12 items-center justify-center rounded-2xl">
        <Bookmark className="text-muted-foreground size-6" />
      </div>
      <p className="font-medium">아직 저장한 기회가 없습니다</p>
      <p className="text-muted-foreground mt-1 text-sm">
        검색 결과에서 마음에 드는 기회를 저장해 보세요.
      </p>
      <Button asChild className="mt-6">
        <Link href="/search">기회 검색하러 가기</Link>
      </Button>
    </div>
  );
}
