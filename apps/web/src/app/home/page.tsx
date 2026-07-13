import { DashboardHome } from '@/features/search';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '오늘의 업무',
  description: '발굴부터 협업까지 오늘 처리할 일을 한눈에.',
};

/** Post-login home — the daily command center for the Creator Partnership CRM. */
export default function HomePage() {
  return <DashboardHome />;
}
