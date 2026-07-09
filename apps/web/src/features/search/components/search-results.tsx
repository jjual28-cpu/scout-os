'use client';

import { Skeleton } from '@/components/ui/skeleton';

import { type SearchResult } from '../types';
import { ResultCard } from './result-card';

type SearchResultsProps = {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
};

function ResultSkeleton() {
  return (
    <div className="bg-card rounded-2xl border p-5">
      <div className="flex items-start justify-between">
        <Skeleton className="size-11 rounded-xl" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-5 w-2/3" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-4/5" />
      <div className="mt-4 flex gap-1.5">
        <Skeleton className="h-5 w-12 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <Skeleton className="mt-5 h-4 w-1/2" />
    </div>
  );
}

export function SearchResults({ query, results, isSearching }: SearchResultsProps) {
  return (
    <div className="w-full">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-muted-foreground text-sm">
          {isSearching ? (
            <>
              <span className="text-foreground font-medium">“{query}”</span> 검색 중…
            </>
          ) : (
            <>
              <span className="text-foreground font-medium">“{query}”</span> 에 대한{' '}
              <span className="text-foreground font-medium">{results.length}</span>개의 기회
            </>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isSearching
          ? Array.from({ length: 6 }).map((_, i) => <ResultSkeleton key={i} />)
          : results.map((result) => <ResultCard key={result.id} result={result} />)}
      </div>
    </div>
  );
}
