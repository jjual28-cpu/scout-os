import { AccountPage } from '@/features/account';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: '마이페이지' };

export default function Account() {
  return <AccountPage />;
}
