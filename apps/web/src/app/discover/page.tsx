import { CreatorSearch } from '@/features/search';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '크리에이터·브랜드 찾기',
  description: '원하는 주제나 키워드로 인스타그램 크리에이터를 검색하세요.',
};

/**
 * The main entry point of Scout OS — a search-centric Creator Discovery product.
 * Search any keyword (뷰티, 골프, 반려동물 …) to find real Instagram creators.
 */
export default function DiscoverPage() {
  return <CreatorSearch />;
}
