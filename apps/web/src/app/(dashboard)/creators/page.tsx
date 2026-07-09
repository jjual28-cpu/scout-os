'use client';

import { useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { CreatorGrid, type CreatorFilters } from '@/features/discovery';

export default function CreatorsPage() {
  const [filters] = useState<Partial<CreatorFilters>>({
    sort: { field: 'discoveredAt', direction: 'desc' },
    page: 1,
    pageSize: 24,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Creators"
        description="발굴한 크리에이터·브랜드·셀러를 한곳에서 관리합니다."
      />
      <CreatorGrid filters={filters} />
    </div>
  );
}
