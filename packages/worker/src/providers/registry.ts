import type { Platform, SearchProvider } from '../types.js';

import { instagramProvider } from './instagram.js';

/**
 * Platform → provider registry. To add Threads / TikTok / YouTube / Naver:
 * create `providers/<platform>.ts` implementing `SearchProvider` and register it
 * here — the runner needs no changes.
 */
const providers: Partial<Record<Platform, SearchProvider>> = {
  instagram: instagramProvider,
  // threads:  threadsProvider,
  // tiktok:   tiktokProvider,
  // youtube:  youtubeProvider,
  // naver:    naverProvider,
};

export function getProvider(platform: string): SearchProvider | null {
  return providers[platform as Platform] ?? null;
}
