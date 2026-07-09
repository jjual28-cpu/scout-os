import { DailyDiscovery } from '@/features/search';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Today's Opportunities",
  description: '오늘 Scout OS가 발견한 새로운 기회.',
};

/**
 * The main entry point of Scout OS — the daily discovery feed. Not a dashboard.
 */
export default function DiscoverPage() {
  return <DailyDiscovery />;
}
