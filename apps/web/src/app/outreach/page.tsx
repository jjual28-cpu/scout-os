import { OutreachList } from '@/features/search';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '연락 준비',
  description: '연락예정 상태의 셀럽을 업무 큐로 관리하고 DM 초안을 준비합니다.',
};

export default function OutreachPage() {
  return <OutreachList />;
}
