import { ReportsPage } from '@/features/reports/components/reports-page';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '성과 리포트',
  description: '검색부터 저장, 연락, 답변, 협업까지 캠페인 성과를 확인하세요.',
};

export default function Reports() {
  return <ReportsPage />;
}
