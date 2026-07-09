'use client';

import { PageHeader } from '@/components/layout/page-header';
import { PipelineBoard } from '@/features/crm';

export default function CrmPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="CRM Pipeline" description="협업 진행 현황을 단계별로 관리하세요." />
      <div className="min-h-0 flex-1">
        <PipelineBoard />
      </div>
    </div>
  );
}
