import { SearchExperience } from '@/features/search';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '검색',
  description: '사람을 설명하면 Scout OS가 기회를 찾아냅니다.',
};

/**
 * The primary post-login screen for Scout OS. Search — not a dashboard — is the
 * core of the product.
 */
export default function SearchPage() {
  return <SearchExperience />;
}
