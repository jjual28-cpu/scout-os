'use client';

import { ChevronLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

import { useSearch } from '../hooks/use-search';
import { RecentSearches } from './recent-searches';
import { SearchHero } from './search-hero';
import { SearchResults } from './search-results';

/**
 * Top-level Search experience. Starts as a focused, vertically-centered hero
 * ("what are you looking for?"), then transitions to a results view once a
 * search runs. Results are MOCK only — no engine is connected.
 */
export function SearchExperience() {
  const { query, setQuery, status, results, activeQuery, recent, search, reset, clearRecent } =
    useSearch();

  const showResults = status === 'searching' || status === 'results';

  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col px-6 transition-[max-width] duration-300',
        showResults ? 'max-w-6xl pt-10' : 'max-w-2xl',
      )}
    >
      {!showResults && (
        <div className="flex min-h-[70vh] flex-col justify-center">
          <div className="mb-8 text-center">
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              무엇을 찾고 싶으신가요?
            </h1>
            <p className="text-muted-foreground mt-3 text-pretty">
              사람을 설명하면, Scout OS가 기회를 찾아냅니다.
            </p>
          </div>

          <SearchHero
            query={query}
            onQueryChange={setQuery}
            onSubmit={() => search()}
            isSearching={false}
          />

          <div className="mt-8">
            <RecentSearches items={recent} onSelect={(q) => search(q)} onClear={clearRecent} />
          </div>
        </div>
      )}

      {showResults && (
        <div className="space-y-8 pb-16">
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={reset}
              className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm transition-colors"
            >
              <ChevronLeft className="size-4" />
              처음으로
            </button>
            <SearchHero
              query={query}
              onQueryChange={setQuery}
              onSubmit={() => search()}
              isSearching={status === 'searching'}
            />
          </div>

          <SearchResults
            query={activeQuery}
            results={results}
            isSearching={status === 'searching'}
          />
        </div>
      )}
    </div>
  );
}
