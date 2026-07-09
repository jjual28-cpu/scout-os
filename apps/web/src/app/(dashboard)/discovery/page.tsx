'use client';

import { useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { CreatorGrid, DiscoveryLauncher, type CreatorFilters } from '@/features/discovery';

export default function DiscoveryPage() {
  const [filters] = useState<Partial<CreatorFilters>>({
    sort: { field: 'opportunityScore', direction: 'desc' },
    page: 1,
    pageSize: 24,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Discovery"
        description="AI에게 브리프를 주면 크리에이터·브랜드·셀러를 발굴합니다."
      />
      <DiscoveryLauncher />
      <CreatorGrid filters={filters} />
    </div>
  );
}
