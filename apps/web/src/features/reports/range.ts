/**
 * Report period selection.
 *
 * The period always cuts on `campaigns.created_at` — a campaign COHORT, not an
 * activity timeline. See compute.ts for why that distinction is load-bearing.
 */
export type RangeKey = '7d' | '30d' | '90d' | 'all';

export const RANGE_KEYS: readonly RangeKey[] = ['7d', '30d', '90d', 'all'];

/** The default period. An unknown `?range=` value falls back to this. */
export const DEFAULT_RANGE: RangeKey = '30d';

export const RANGE_LABEL: Record<RangeKey, string> = {
  '7d': '7일',
  '30d': '30일',
  '90d': '90일',
  all: '전체',
};

const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

/** Parse `?range=`. Unknown/missing → 30일 (never an empty screen). */
export function parseRange(search: string): RangeKey {
  const raw = new URLSearchParams(search).get('range');
  return raw && (RANGE_KEYS as readonly string[]).includes(raw) ? (raw as RangeKey) : DEFAULT_RANGE;
}

export function reportsHref(range: RangeKey): string {
  return `/reports?range=${range}`;
}

/**
 * Inclusive start of a period, as epoch ms. `all` → null (no lower bound).
 * Cuts at LOCAL midnight so "7일" means 7 whole days as the user experiences
 * them, not a rolling 168h window.
 */
export function rangeStart(range: RangeKey, now: Date): number | null {
  if (range === 'all') return null;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (RANGE_DAYS[range] - 1));
  return d.getTime();
}

/** Is this ISO timestamp inside the period? `all` accepts everything. */
export function inRange(iso: string, start: number | null): boolean {
  if (start === null) return true;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= start;
}
