import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

import { type DealWithCreator } from '../types';

export function DealCard({ deal }: { deal: DealWithCreator }) {
  return (
    <Card className="cursor-grab p-3 transition-shadow hover:shadow-md active:cursor-grabbing">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          {deal.creator.avatarUrl ? <AvatarImage src={deal.creator.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-xs">
            {deal.creator.displayName.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{deal.creator.displayName}</p>
          {deal.creator.handle ? (
            <p className="text-muted-foreground truncate text-xs">@{deal.creator.handle}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {deal.value != null ? (
          <span className="text-xs font-medium">{formatCurrency(deal.value, deal.currency)}</span>
        ) : (
          <span className="text-muted-foreground text-xs">미정</span>
        )}
        {deal.creator.opportunityScore != null ? (
          <Badge variant="outline" className="text-[10px]">
            {deal.creator.opportunityScore}점
          </Badge>
        ) : null}
      </div>
    </Card>
  );
}
