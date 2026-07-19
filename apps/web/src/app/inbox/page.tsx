import { InboxPage } from '@/features/inbox/components/inbox-page';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '받은 답장',
  description: '셀럽이 DM에 답장하면 여기에 모여요.',
};

export const dynamic = 'force-dynamic';

export default function Inbox() {
  return <InboxPage />;
}
