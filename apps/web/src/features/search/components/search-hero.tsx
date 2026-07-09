'use client';

import { ArrowRight, Loader2, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { SEARCH_PLACEHOLDERS } from '../mock-data';

type SearchHeroProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  isSearching: boolean;
};

/**
 * The centerpiece of Scout OS: one very large search input. The placeholder
 * gently rotates through example prompts while the field is empty, so users
 * immediately understand the breadth of what they can ask for.
 */
export function SearchHero({ query, onQueryChange, onSubmit, isSearching }: SearchHeroProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query) return; // don't rotate while the user is typing
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2600);
    return () => clearInterval(id);
  }, [query]);

  return (
    <div className="w-full">
      <div
        className={cn(
          'bg-card group relative flex items-center gap-3 rounded-2xl border px-5',
          'shadow-sm transition-all duration-200',
          'focus-within:border-primary/40 focus-within:shadow-primary/5 focus-within:shadow-lg',
          'h-16 sm:h-[4.5rem]',
        )}
      >
        <Search className="text-muted-foreground group-focus-within:text-primary size-5 shrink-0 transition-colors" />

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
          placeholder={SEARCH_PLACEHOLDERS[placeholderIndex]}
          aria-label="기회 검색"
          className="placeholder:text-muted-foreground/70 h-full flex-1 border-0 bg-transparent text-lg outline-none sm:text-xl"
        />

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSearching || !query.trim()}
          aria-label="기회 찾기"
          className={cn(
            'inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium',
            'bg-primary text-primary-foreground transition-all',
            'hover:bg-primary/90 disabled:opacity-40',
          )}
        >
          {isSearching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <span className="hidden sm:inline">기회 찾기</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
