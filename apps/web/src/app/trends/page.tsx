import { AudioTrends } from '@/features/trends/components/audio-trends';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '트렌드 음원',
  description: '릴스에서 지금 많이 쓰이는·고조회·급상승 음원을 찾아보세요.',
};

/** 릴스 트렌드 음원 — 릴스를 긁어 음원별로 많이 쓴/고조회/급상승을 랭킹. */
export default function TrendsPage() {
  return <AudioTrends />;
}
