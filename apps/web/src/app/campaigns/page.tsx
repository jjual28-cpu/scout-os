import { CampaignList } from '@/features/campaigns';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '캠페인',
  description: '검색 기록과 크리에이터 진행 현황을 관리합니다.',
};

export default function Campaigns() {
  return <CampaignList />;
}
