import { CampaignDetail } from '@/features/campaigns';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '캠페인 상세',
  description: '캠페인의 검색 결과와 진행 현황을 봅니다.',
};

export default function CampaignDetailPage({ params }: { params: { campaignId: string } }) {
  return <CampaignDetail id={params.campaignId} />;
}
