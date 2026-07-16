import { SettingsPage } from '@/features/settings/components/settings-page';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '설정',
  description: 'AI 연결과 기본 작업 환경을 관리합니다.',
};

export default function Settings() {
  return <SettingsPage />;
}
