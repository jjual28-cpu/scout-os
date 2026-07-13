import { CrmBoard } from '@/features/search';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CRM',
  description: '크리에이터를 발견부터 협업까지 단계별로 관리합니다.',
};

/** CRM Kanban board — the pipeline over saved + outreach data. */
export default function CrmPage() {
  return <CrmBoard />;
}
