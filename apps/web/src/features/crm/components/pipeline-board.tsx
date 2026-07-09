'use client';

import { Skeleton } from '@/components/ui/skeleton';

import { usePipeline } from '../hooks/use-pipeline';
import { PIPELINE_STAGES } from '../schemas';
import { DealCard } from './deal-card';

/**
 * The CRM Kanban board. Columns are the ordered pipeline stages; each holds the
 * deals currently in that stage. Drag-and-drop wiring (dnd-kit) plugs into
 * `useUpdateDealStage` — kept out here to keep the scaffold dependency-light.
 */
export function PipelineBoard({ campaignId }: { campaignId?: string }) {
  const { data, isLoading } = usePipeline(campaignId);

  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4">
      {PIPELINE_STAGES.map(({ stage, label }) => {
        const deals = data?.[stage] ?? [];
        return (
          <div key={stage} className="bg-muted/50 flex w-72 shrink-0 flex-col rounded-lg">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-medium">{label}</span>
              <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                {deals.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : deals.length === 0 ? (
                <div className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-xs">
                  비어 있음
                </div>
              ) : (
                deals.map((deal) => <DealCard key={deal.id} deal={deal} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
