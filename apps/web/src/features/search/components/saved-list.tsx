'use client';

import { Bookmark, Tag, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useOutreach } from '../hooks/use-outreach';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';
import { FILTER_OPTIONS, type StatusFilter } from '../status';
import { SavedOpportunityCard } from './saved-opportunity-card';

export function SavedList() {
  const { saved, count, hydrated, setStatus, setNote, remove, clear } = useSavedOpportunities();
  const outreach = useOutreach();
  const [filter, setFilter] = useState<StatusFilter>('전체');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const tagsFor = (id: string): string[] => outreach.records[id]?.tags ?? [];

  // 저장된 셀럽들에 실제로 붙은 태그 목록(빈도순) — 태그 필터 칩으로 노출.
  const allTags = useMemo(() => {
    const freq = new Map<string, number>();
    for (const s of saved) for (const t of tagsFor(s.id)) freq.set(t, (freq.get(t) ?? 0) + 1);
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, outreach.records]);

  const countFor = (option: StatusFilter) =>
    option === '전체' ? saved.length : saved.filter((s) => s.status === option).length;

  const filtered = saved.filter((s) => {
    if (filter !== '전체' && s.status !== filter) return false;
    if (tagFilter && !tagsFor(s.id).includes(tagFilter)) return false;
    return true;
  });

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

          {/* 태그 필터 — 저장된 셀럽에 붙은 태그가 있을 때만 */}
          {allTags.length > 0 ? (
            <div className="mb-6 flex flex-wrap items-center gap-1.5">
              <Tag className="text-muted-foreground size-3.5" />
              {allTags.map((t) => {
                const active = tagFilter === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTagFilter(active ? null : t)}
                    className={cn(
                      'inline-flex items-center gap-0.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-primary/30 text-primary hover:bg-primary/10',
                    )}
                  >
                    {t}
                  </button>
                );
              })}
              {tagFilter ? (
                <button
                  type="button"
                  onClick={() => setTagFilter(null)}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-xs"
                >
                  <X className="size-3" />
                  태그 해제
                </button>
              ) : null}
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="text-muted-foreground rounded-2xl border border-dashed py-16 text-center text-sm">
              {tagFilter
                ? `‘${tagFilter}’ 태그${filter !== '전체' ? ` · ‘${filter}’ 상태` : ''}의 기회가 없습니다.`
                : `‘${filter}’ 상태의 기회가 없습니다.`}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <SavedOpportunityCard
                  key={item.id}
                  item={item}
                  tags={tagsFor(item.id)}
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
