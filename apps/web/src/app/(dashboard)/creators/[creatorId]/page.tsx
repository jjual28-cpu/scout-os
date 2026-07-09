import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyzeButton } from '@/features/analysis';
import { getCreator } from '@/features/discovery/services/discovery.service';
import { requireSession } from '@/lib/auth/session';
import { formatCompactNumber, formatPercent } from '@/lib/utils';

export default async function CreatorDetailPage({ params }: { params: { creatorId: string } }) {
  const session = await requireSession();
  const creator = await getCreator(session.workspaceId, params.creatorId);
  if (!creator) notFound();

  const latestAnalysis = creator.analyses[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={creator.displayName}
        description={creator.handle ? `@${creator.handle}` : undefined}
        actions={<AnalyzeButton creatorId={creator.id} />}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex-row items-center gap-4 space-y-0">
            <Avatar className="h-16 w-16">
              {creator.avatarUrl ? <AvatarImage src={creator.avatarUrl} alt="" /> : null}
              <AvatarFallback>{creator.displayName.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{creator.displayName}</CardTitle>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="secondary">{creator.type}</Badge>
                {creator.category ? <Badge variant="outline">{creator.category}</Badge> : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{creator.bio ?? '소개가 없습니다.'}</p>
            <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4 text-sm">
              <Stat label="팔로워" value={formatCompactNumber(creator.totalFollowers)} />
              <Stat label="참여율" value={formatPercent(creator.avgEngagement)} />
              <Stat label="기회 점수" value={creator.opportunityScore?.toString() ?? '—'} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">최신 AI 분석</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {latestAnalysis ? (
              <div className="space-y-2">
                <Badge variant="success">{latestAnalysis.score ?? '—'}점</Badge>
                <p className="text-muted-foreground">{latestAnalysis.summary}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                아직 분석이 없습니다. 우측 상단에서 실행하세요.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
