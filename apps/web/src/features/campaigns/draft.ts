import { type CampaignDraft } from './types';

const KEY = 'scout:campaign-draft';

/**
 * A one-shot handoff from a Campaign (다시 검색 / 복제) into the /discover search.
 * Stored in sessionStorage so a full navigation carries the query + metadata, then
 * consumed once so a later manual search isn't accidentally tagged with old meta.
 */
export function stashCampaignDraft(draft: CampaignDraft): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

/** Read + clear the pending draft (returns null if none). */
export function consumeCampaignDraft(): CampaignDraft | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as CampaignDraft;
  } catch {
    return null;
  }
}
