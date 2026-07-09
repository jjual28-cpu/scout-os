import { Radar, Sparkles, KanbanSquare, TrendingUp } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

const stats = [
  { label: '이번 주 신규 발굴', value: '128', icon: Radar, delta: '+24%' },
  { label: 'AI 분석 완료', value: '86', icon: Sparkles, delta: '+12%' },
  { label: '진행 중 협업', value: '17', icon: KanbanSquare, delta: '+3' },
  { label: '평균 기회 점수', value: '74', icon: TrendingUp, delta: '+5' },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="오늘의 기회" description="Scout OS가 밤사이 발견한 기회를 확인하세요." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {s.label}
                </CardTitle>
                <Icon className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {s.delta} 지난주 대비
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>추천 기회</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            발굴 결과가 여기에 표시됩니다. Discovery에서 브리프를 실행해 보세요.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>AI 활동</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-3 text-sm">
            <p>· 오늘 아침 마이크로 크리에이터 42명 발굴</p>
            <p>· 팔로업 필요 협업 5건</p>
            <p>· 응답 대기 DM 8건</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
