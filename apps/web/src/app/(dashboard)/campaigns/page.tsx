import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Campaigns' };

export default function CampaignsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Campaigns"
        description="협업 캠페인을 만들고 크리에이터를 배정하세요."
        actions={<Button size="sm">새 캠페인</Button>}
      />
      <Card>
        <CardContent className="text-muted-foreground p-10 text-center text-sm">
          아직 캠페인이 없습니다. 첫 캠페인을 만들어 CRM 파이프라인과 연결하세요.
        </CardContent>
      </Card>
    </div>
  );
}
