import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'AI Analysis' };

export default function AnalysisPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="AI Analysis"
        description="크리에이터의 적합도·성장성·리스크를 AI가 스코어링합니다."
      />
      <Card>
        <CardContent className="text-muted-foreground p-10 text-center text-sm">
          크리에이터 상세 페이지에서 &lsquo;AI 분석&rsquo;을 실행하면 결과가 여기에 모입니다.
        </CardContent>
      </Card>
    </div>
  );
}
