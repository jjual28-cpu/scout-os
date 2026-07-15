'use client';

/**
 * Pointer to the Campaign the user was last looking at in Discover.
 *
 * Only the ID lives here — every result still comes from `campaign_results` in
 * the DB. This is what makes Discover a Workspace: it reopens your last session
 * instead of a blank search box. Restore priority is:
 *   ?campaign=<id> → this pointer → newest running → succeeded → failed.
 */
const KEY = 'scout:last-campaign';

export function setLastViewedCampaign(id: string): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

export function getLastViewedCampaign(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearLastViewedCampaign(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
