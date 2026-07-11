'use client';

import { Bookmark, BookmarkCheck, CalendarDays, Instagram } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { type DiscoverOpportunity } from '../discover-mock';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';
import { OpportunityBody } from './opportunity-body';

export function DiscoverCard({ item }: { item: DiscoverOpportunity }) {
  const { isSaved, toggle } = useSavedOpportunities();
  const saved = isSaved(item.id);

  return (
    <article
      className={cn(
        'bg-card group relative flex flex-col overflow-hidden rounded-2xl border p-5',
        'transition-all duration-200 ease-out',
        'hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/[0.04]',
      )}
    >
      <div
        aria-hidden
        className="via-primary/50 pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <OpportunityBody result={item} />

      {/* 발견일 + 실제 프로필 링크 */}
      <div className="text-muted-foreground mt-4 flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          발견일 · {item.discoveredAt}
        </span>
        {item.profileUrl ? (
          <a
            href={item.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
          >
            <Instagram className="size-3.5" />
            프로필 열기
          </a>
        ) : null}
      </div>

      {/* 저장 */}
      <Button
        type="button"
        variant={saved ? 'secondary' : 'outline'}
        className="mt-4 w-full"
        aria-pressed={saved}
        onClick={() => toggle(item)}
      >
        {saved ? (
          <>
            <BookmarkCheck className="size-4" />
            저장됨
          </>
        ) : (
          <>
            <Bookmark className="size-4" />
            저장
          </>
        )}
      </Button>
    </article>
  );
}
