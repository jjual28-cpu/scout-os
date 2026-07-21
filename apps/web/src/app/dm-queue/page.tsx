import { DmQueue } from '@/features/search';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DM 발송',
  description: '연락할 셀럽을 한 명씩 넘기며 빠르게 DM을 보내는 발송 큐.',
};

export const dynamic = 'force-dynamic';

export default function DmQueuePage() {
  return <DmQueue />;
}
