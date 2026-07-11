import type { Page } from 'playwright';

/** Platforms the Scout Worker can (or will) discover. Extend this union + add a provider. */
export type Platform = 'instagram' | 'threads' | 'tiktok' | 'youtube' | 'naver';

/**
 * Platform-agnostic creator record. Maps to the `discovered_creators` table.
 * `rawData` is preserved verbatim so a later AI-analysis step has full context.
 */
export type NormalizedCreator = {
  platform: string;
  /** Stable id, e.g. `instagram:username`. */
  externalId: string;
  username: string;
  displayName: string;
  profileUrl: string;
  profileImageUrl: string | null;
  biography: string | null;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  isVerified: boolean;
  category: string | null;
  rawData: unknown;
};

/** A row claimed from `discovery_jobs`. */
export type DiscoveryJob = {
  id: string;
  user_id: string;
  platform: string;
  provider: string;
  query: string;
  status: string;
  attempts: number;
};

export type Logger = (message: string, meta?: unknown) => void;

/** What a provider receives to do its work. Providers never touch the DB directly. */
export type SearchContext = {
  /** Open a fresh, isolated browser page. */
  newPage: () => Promise<Page>;
  /** Target number of creators to collect. */
  limit: number;
  log: Logger;
};

/**
 * A per-platform public discovery provider. The registry maps `platform` →
 * provider, so adding Threads/TikTok/YouTube/Naver is just a new file + registry
 * entry — no changes to the runner.
 */
export interface SearchProvider {
  platform: Platform;
  /** Collect public creators for a query. Throw `BlockedError` on login/captcha/block. */
  search(query: string, ctx: SearchContext): Promise<NormalizedCreator[]>;
}

/**
 * Raised when a page requires login, shows a captcha, or otherwise blocks the
 * worker. Per policy we DO NOT bypass these — the job is failed and the reason
 * is recorded.
 */
export class BlockedError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'BlockedError';
  }
}
