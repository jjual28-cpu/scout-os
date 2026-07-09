'use client';

import { ArrowUpLeft, Clock } from 'lucide-react';

type RecentSearchesProps = {
  items: string[];
  onSelect: (value: string) => void;
  onClear: () => void;
};

export function RecentSearches({ items, onSelect, onClear }: RecentSearchesProps) {
  if (items.length === 0) return null;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <Clock className="size-3.5" />
          최근 검색어
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
        >
          지우기
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            className="bg-card text-foreground/80 hover:border-primary/40 hover:bg-accent hover:text-foreground group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-all"
          >
            <ArrowUpLeft className="text-muted-foreground/50 group-hover:text-primary size-3 transition-colors" />
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
