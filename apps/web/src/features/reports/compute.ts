import { computeSummary } from '@/features/campaigns/summary';
import { type Campaign } from '@/features/campaigns/types';
import { type OutreachRecord } from '@/features/search/store/outreach-store';

import { inRange, rangeStart, type RangeKey } from './range';

/**
 * Report aggregation — pure functions over data the app already loads.
 *
 * ── COHORT SEMANTICS (read this before changing anything) ───────────────────
 * The period cuts on `campaigns.created_at`. Every funnel number is therefore
 * "what the campaigns CREATED in this period have produced so far" — NOT "what
 * happened during this period".
 *
 * This is forced by the schema, not by preference: `outreach_activities` records
 * WHEN a DM went out (`contacted_at`) but not when a reply arrived or a collab
 * closed. `updated_at` changes on any edit, so using it as a reply/collab time
 * would produce numbers that look precise and are wrong. So we don't. Never
 * label these as 추이/timeline in the UI.
 *
 * ── 검색 수 vs. 퍼널 (deliberately different denominators) ───────────────────
 *   검색 수 → ALL campaigns in the cohort (succeeded + running + failed)
 *   퍼널   → SUCCEEDED campaigns only
 * A failed search has no results; counting it in the funnel would only inflate
 * the denominator. The split is enforced by `cohort()` returning both lists.
 */

type Records = Record<string, OutreachRecord>;

/** Which campaigns a report covers, split by the two denominators above. */
export type Cohort = {
  /** Campaigns created inside the period — every status. Basis for 검색 수. */
  all: Campaign[];
  /** The succeeded subset — the basis for every funnel metric. */
  succeeded: Campaign[];
  /** Real `campaigns.status` counts, for the 검색 수 sub-line. */
  statusCounts: { succeeded: number; running: number; failed: number };
};

export function cohort(campaigns: Campaign[], range: RangeKey, now: Date): Cohort {
  const start = rangeStart(range, now);
  const all = campaigns.filter((c) => inRange(c.createdAt, start));
  return {
    all,
    succeeded: all.filter((c) => c.status === 'succeeded'),
    statusCounts: {
      succeeded: all.filter((c) => c.status === 'succeeded').length,
      running: all.filter((c) => c.status === 'running').length,
      failed: all.filter((c) => c.status === 'failed').length,
    },
  };
}

export type ReportKpis = {
  /** 전체 campaigns (모든 status). */
  searches: number;
  statusCounts: Cohort['statusCounts'];
  /** 캠페인별 발견 수의 합 — 같은 셀럽이 두 캠페인에 있으면 2로 셈. */
  discovered: number;
  /** 중복 제거한 고유 셀럽 수. discovered 와의 차이가 곧 중복량. */
  uniqueCreators: number;
  saved: number;
  dm: number;
  reply: number;
  collab: number;
  /** 협업 ÷ DM × 100, 반올림. DM=0 → 0. */
  conversion: number;
};

/** creatorIds for one campaign, from the campaign→creator link table. */
export type CreatorLinks = Map<string, string[]>;

function creatorsOf(links: CreatorLinks, campaignId: string): string[] {
  return links.get(campaignId) ?? [];
}

export function computeKpis(
  c: Cohort,
  links: CreatorLinks,
  savedSet: Set<string>,
  records: Records,
): ReportKpis {
  const unique = new Set<string>();
  let discovered = 0;
  let saved = 0;
  let dm = 0;
  let reply = 0;
  let collab = 0;

  for (const campaign of c.succeeded) {
    const ids = creatorsOf(links, campaign.id);
    for (const id of ids) unique.add(id);
    // Reuse the exact function the campaign list/detail use, so a number here can
    // never disagree with the same number there.
    const s = computeSummary(ids.length, ids, savedSet, records);
    discovered += s.discovered;
    saved += s.saved;
    dm += s.dm;
    reply += s.reply;
    collab += s.collab;
  }

  return {
    searches: c.all.length,
    statusCounts: c.statusCounts,
    discovered,
    uniqueCreators: unique.size,
    saved,
    dm,
    reply,
    collab,
    conversion: dm > 0 ? Math.round((collab / dm) * 100) : 0,
  };
}

// ── Top 검색어 ───────────────────────────────────────────────────────────────

export type TopQuery = {
  /** Grouping key — DB-normalised (trim + 공백 1칸 + lowercase). */
  key: string;
  /** Display text: the most RECENT raw query in the group. */
  query: string;
  searches: number;
  discovered: number;
  collab: number;
};

/**
 * Group by the same normalisation the DB uses for cache/running/unique checks,
 * so "키링"과 "키링 " 이 한 줄로 합쳐진다. Display keeps the user's own text.
 */
export function topQueries(
  c: Cohort,
  links: CreatorLinks,
  savedSet: Set<string>,
  records: Records,
  limit = 5,
): TopQuery[] {
  const groups = new Map<string, { newest: Campaign; rows: Campaign[] }>();
  for (const campaign of c.succeeded) {
    const key = normalize(campaign.query);
    const g = groups.get(key);
    if (!g) groups.set(key, { newest: campaign, rows: [campaign] });
    else {
      g.rows.push(campaign);
      if (campaign.createdAt > g.newest.createdAt) g.newest = campaign;
    }
  }

  const out: TopQuery[] = [];
  for (const [key, g] of groups) {
    let discovered = 0;
    let collab = 0;
    for (const campaign of g.rows) {
      const ids = creatorsOf(links, campaign.id);
      const s = computeSummary(ids.length, ids, savedSet, records);
      discovered += s.discovered;
      collab += s.collab;
    }
    out.push({ key, query: g.newest.query, searches: g.rows.length, discovered, collab });
  }

  return out.sort((a, b) => b.searches - a.searches || b.discovered - a.discovered).slice(0, limit);
}

/** Mirrors the DB's `query_norm` generated column. Comparison only. */
function normalize(q: string): string {
  return q.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ── Top 캠페인 ───────────────────────────────────────────────────────────────

export type TopCampaign = {
  id: string;
  title: string;
  query: string;
  discovered: number;
  dm: number;
  reply: number;
  collab: number;
};

/** Ranked 협업 → 답변 → DM → 발견. */
export function topCampaigns(
  c: Cohort,
  links: CreatorLinks,
  savedSet: Set<string>,
  records: Records,
  limit = 5,
): TopCampaign[] {
  return c.succeeded
    .map((campaign) => {
      const ids = creatorsOf(links, campaign.id);
      const s = computeSummary(ids.length, ids, savedSet, records);
      return {
        id: campaign.id,
        title: campaign.title,
        query: campaign.query,
        discovered: s.discovered,
        dm: s.dm,
        reply: s.reply,
        collab: s.collab,
      };
    })
    .sort(
      (a, b) =>
        b.collab - a.collab || b.reply - a.reply || b.dm - a.dm || b.discovered - a.discovered,
    )
    .slice(0, limit);
}

// ── 상품별 성과 ──────────────────────────────────────────────────────────────

export type ProductRow = {
  /** null → 상품 미지정 bucket. */
  productId: string | null;
  name: string;
  campaigns: number;
  discovered: number;
  saved: number;
  dm: number;
  reply: number;
  collab: number;
  conversion: number;
};

const UNASSIGNED = '상품 미지정';

/**
 * Per-product rollup. Campaigns without a product_id go into an explicit
 * 상품 미지정 row — dropping them would make the rows not add up to the KPIs.
 */
export function productRows(
  c: Cohort,
  links: CreatorLinks,
  savedSet: Set<string>,
  records: Records,
): ProductRow[] {
  const acc = new Map<string, ProductRow>();

  for (const campaign of c.succeeded) {
    const key = campaign.productId ?? '';
    let row = acc.get(key);
    if (!row) {
      row = {
        productId: campaign.productId,
        name: campaign.productName ?? UNASSIGNED,
        campaigns: 0,
        discovered: 0,
        saved: 0,
        dm: 0,
        reply: 0,
        collab: 0,
        conversion: 0,
      };
      acc.set(key, row);
    }
    const ids = creatorsOf(links, campaign.id);
    const s = computeSummary(ids.length, ids, savedSet, records);
    row.campaigns += 1;
    row.discovered += s.discovered;
    row.saved += s.saved;
    row.dm += s.dm;
    row.reply += s.reply;
    row.collab += s.collab;
  }

  const rows = [...acc.values()];
  for (const r of rows) r.conversion = r.dm > 0 ? Math.round((r.collab / r.dm) * 100) : 0;
  // Best performers first; 상품 미지정 always sinks to the bottom.
  return rows.sort((a, b) => {
    if (!a.productId !== !b.productId) return a.productId ? -1 : 1;
    return b.collab - a.collab || b.dm - a.dm || b.discovered - a.discovered;
  });
}
