import type { Creator, Deal, DealStage } from '@scout-os/database';

/** A deal joined with its creator, as shown on a pipeline card. */
export type DealWithCreator = Deal & {
  creator: Pick<Creator, 'id' | 'displayName' | 'handle' | 'avatarUrl' | 'opportunityScore'>;
};

/** Deals grouped by pipeline stage — the shape the board consumes. */
export type PipelineColumns = Record<DealStage, DealWithCreator[]>;
