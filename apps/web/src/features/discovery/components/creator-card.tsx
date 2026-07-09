import Link from 'next/link';
import { Instagram, Youtube, Music2, FileText, Globe } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Platform } from '@/types';
import { cn, formatCompactNumber, formatPercent } from '@/lib/utils';

import { type CreatorSummary } from '../types';

const platformIcon: Record<Platform, typeof Instagram> = {
  [Platform.INSTAGRAM]: Instagram,
  [Platform.YOUTUBE]: Youtube,
  [Platform.TIKTOK]: Music2,
  [Platform.BLOG]: FileText,
  [Platform.X]: Globe,
  [Platform.THREADS]: Globe,
  [Platform.OTHER]: Globe,
};

function scoreTone(score: number | null | undefined) {
  if (score == null) return 'secondary' as const;
  if (score >= 80) return 'success' as const;
  if (score >= 60) return 'warning' as const;
  return 'secondary' as const;
}

export function CreatorCard({ creator }: { creator: CreatorSummary }) {
  return (
    <Link href={`/creators/${creator.id}`} className="group block">
      <Card className="transition-shadow group-hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              {creator.avatarUrl ? <AvatarImage src={creator.avatarUrl} alt="" /> : null}
              <AvatarFallback>{creator.displayName.slice(0, 2)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{creator.displayName}</p>
              {creator.handle ? (
                <p className="text-muted-foreground truncate text-sm">@{creator.handle}</p>
              ) : null}
            </div>

            {creator.opportunityScore != null ? (
              <Badge variant={scoreTone(creator.opportunityScore)}>
                {creator.opportunityScore}점
              </Badge>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {creator.category ? (
              <Badge variant="outline" className="text-xs">
                {creator.category}
              </Badge>
            ) : null}
            {creator.niches.slice(0, 2).map((n) => (
              <Badge key={n} variant="secondary" className="text-xs">
                {n}
              </Badge>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
            <div>
              <span className="font-medium">{formatCompactNumber(creator.totalFollowers)}</span>
              <span className="text-muted-foreground ml-1">followers</span>
            </div>
            <div className="text-muted-foreground">
              참여율 {formatPercent(creator.avgEngagement)}
            </div>
            <div className="text-muted-foreground flex items-center gap-1.5">
              {creator.platforms.map((p) => {
                const Icon = platformIcon[p];
                return <Icon key={p} className={cn('size-4')} />;
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
