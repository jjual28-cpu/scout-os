'use client';

import { Radar } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

import { useCreators } from '../hooks/use-creators';
import { type CreatorFilters } from '../schemas';
import { CreatorCard } from './creator-card';

export function CreatorGrid({ filters }: { filters: Partial<CreatorFilters> }) {
  const { data, isLoading, isError } = useCreators(filters);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center text-sm">
        크리에이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Radar className="text-muted-foreground mb-3 size-8" />
        <p className="font-medium">아직 발굴된 대상이 없습니다</p>
        <p className="text-muted-foreground mt-1 text-sm">
          위에서 발굴 브리프를 작성해 AI에게 기회를 찾게 하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.items.map((creator) => (
        <CreatorCard key={creator.id} creator={creator} />
      ))}
    </div>
  );
}
