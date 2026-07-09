'use client';

import { ArrowRight, Bookmark, BookmarkCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useSavedOpportunities } from '../hooks/use-saved-opportunities';
import { type SearchResult } from '../types';
import { OpportunityBody } from './opportunity-body';

export function ResultCard({ result }: { result: SearchResult }) {
  const { isSaved, toggle } = useSavedOpportunities();
  const saved = isSaved(result.id);

  return (
    <article
      className={cn(
        'bg-card group relative flex flex-col overflow-hidden rounded-2xl border p-5',
        'transition-all duration-200 ease-out',
        'hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/[0.04]',
      )}
    >
      {/* Hover accent line */}
      <div
        aria-hidden
        className="via-primary/50 pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <OpportunityBody result={result} />

      {/* 액션: 저장 + 자세히 보기 */}
      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          variant={saved ? 'secondary' : 'outline'}
          className="flex-1"
          aria-pressed={saved}
          onClick={() => toggle(result)}
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
        <Button type="button" variant="outline" className="flex-1">
          자세히 보기
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </article>
  );
}
