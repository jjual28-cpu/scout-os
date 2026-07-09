import { SavedList } from '@/features/search';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '저장한 기회',
  description: '저장한 기회 목록.',
};

export default function SavedPage() {
  return <SavedList />;
}
