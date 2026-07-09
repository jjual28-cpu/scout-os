import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="워크스페이스와 연동을 관리합니다." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">워크스페이스</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">이름</Label>
            <Input id="ws-name" defaultValue="Demo Workspace" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-slug">슬러그</Label>
            <Input id="ws-slug" defaultValue="demo" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
