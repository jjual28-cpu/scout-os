import type { Creator, SocialAccount } from '@scout-os/database';

/** A creator enriched with its social accounts, as returned to the UI. */
export type CreatorWithAccounts = Creator & {
  socialAccounts: SocialAccount[];
};

/** Lightweight card projection for grid/list views. */
export type CreatorSummary = Pick<
  Creator,
  | 'id'
  | 'displayName'
  | 'handle'
  | 'avatarUrl'
  | 'type'
  | 'status'
  | 'category'
  | 'niches'
  | 'totalFollowers'
  | 'avgEngagement'
  | 'opportunityScore'
> & {
  platforms: SocialAccount['platform'][];
};
