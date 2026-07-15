import { LABEL_META } from './label';
import { type Campaign, type CampaignLabel, type CampaignStatus } from './types';

/**
 * Campaign list filtering — the single source of truth shared by the Dashboard
 * KPI cards and /campaigns, so a KPI count can never disagree with the list it
 * links to.
 *
 * Two INDEPENDENT axes. Never conflate them:
 *   - label  (workflow, user-set):    active / hold / done / failed → 진행중 / 보류 / 완료 / 실패
 *   - status (execution, system-set): running / succeeded / failed  → 검색 중 / 검색 완료 / 검색 실패
 * A finished search is status=succeeded but usually still label=active, and a
 * running search can carry any label. Filtering one by the other's value yields
 * an empty list even though the data is there.
 */
export type CampaignFilter =
  { kind: 'label'; value: CampaignLabel } | { kind: 'status'; value: CampaignStatus };

const LABELS: readonly string[] = ['active', 'hold', 'done', 'failed'];
const STATUSES: readonly string[] = ['running', 'succeeded', 'failed'];

/** 진행 중(워크플로) 캠페인 — Dashboard KPI 및 그 링크가 함께 쓰는 기준. */
export const ACTIVE_FILTER: CampaignFilter = { kind: 'label', value: 'active' };
/** 검색이 실행 중인 캠페인. */
export const RUNNING_FILTER: CampaignFilter = { kind: 'status', value: 'running' };

/**
 * Parse `?label=` / `?status=` off a location search string. `label` wins if both
 * are present. Anything unrecognised (or absent) → null, which means "show all" —
 * a bad query param must never strand the user on an empty list.
 */
export function parseCampaignFilter(search: string): CampaignFilter | null {
  const params = new URLSearchParams(search);
  const label = params.get('label');
  if (label && LABELS.includes(label)) return { kind: 'label', value: label as CampaignLabel };
  const status = params.get('status');
  if (status && STATUSES.includes(status))
    return { kind: 'status', value: status as CampaignStatus };
  return null;
}

function matches(c: Campaign, f: CampaignFilter): boolean {
  return f.kind === 'label' ? c.label === f.value : c.status === f.value;
}

/** Apply a filter to the list. `null` → the full list, unchanged. */
export function filterCampaigns(list: Campaign[], f: CampaignFilter | null): Campaign[] {
  return f ? list.filter((c) => matches(c, f)) : list;
}

/** Count under a filter — KPI cards use this so number and list always agree. */
export function countCampaigns(list: Campaign[], f: CampaignFilter): number {
  return list.reduce((n, c) => (matches(c, f) ? n + 1 : n), 0);
}

/** The /campaigns URL for a filter. KPI links and the chip derive from this. */
export function campaignsHref(f: CampaignFilter | null): string {
  return f ? `/campaigns?${f.kind}=${encodeURIComponent(f.value)}` : '/campaigns';
}

const STATUS_TEXT: Record<CampaignStatus, string> = {
  running: '검색 중',
  succeeded: '검색 완료',
  failed: '검색 실패',
};

/** Korean text for the active-filter chip. */
export function filterText(f: CampaignFilter): string {
  return f.kind === 'label' ? LABEL_META[f.value].label : STATUS_TEXT[f.value];
}

/** Chip colour — mirrors how the same value is coloured in the list rows. */
export function filterTone(f: CampaignFilter): 'emerald' | 'amber' | 'blue' | 'rose' | 'neutral' {
  if (f.kind === 'status') {
    return f.value === 'running' ? 'amber' : f.value === 'failed' ? 'rose' : 'emerald';
  }
  return f.value === 'active'
    ? 'emerald'
    : f.value === 'hold'
      ? 'amber'
      : f.value === 'done'
        ? 'blue'
        : 'rose';
}
