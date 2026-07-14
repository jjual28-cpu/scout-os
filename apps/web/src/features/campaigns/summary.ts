import { toStage } from '@/features/search/crm-stages';
import { type OutreachRecord } from '@/features/search/store/outreach-store';

import { type RawCampaign } from './services/campaign-service';
import { type CampaignLastAction, type CampaignSummary } from './types';

type Records = Record<string, OutreachRecord>;

/**
 * Funnel KPIs for a campaign, DERIVED from its creators' saved/outreach state.
 * 전환율 = 협업 ÷ DM × 100 (0 when DM = 0). Never stored — computed at read time.
 */
export function computeSummary(
  discovered: number,
  creatorIds: string[],
  savedSet: Set<string>,
  records: Records,
): CampaignSummary {
  let saved = 0;
  let dm = 0;
  let reply = 0;
  let collab = 0;
  for (const cid of creatorIds) {
    if (savedSet.has(cid)) saved++;
    const rec = records[cid];
    if (!rec) continue;
    const stage = toStage(rec.status);
    if (rec.contactedAt || stage === '연락 완료' || stage === '답변' || stage === '협업') dm++;
    if (stage === '답변') reply++;
    if (stage === '협업') collab++;
  }
  const conversion = dm > 0 ? Math.round((collab / dm) * 100) : 0;
  return { discovered, saved, dm, reply, collab, conversion };
}

/** The most-advanced activity on a campaign, with the best timestamp available. */
export function computeLastAction(
  campaign: RawCampaign,
  creatorIds: string[],
  savedSet: Set<string>,
  records: Records,
): CampaignLastAction | null {
  let savedCount = 0;
  let dm = 0;
  let reply = 0;
  let collab = 0;
  let latestContactedAt: string | null = null;
  for (const cid of creatorIds) {
    if (savedSet.has(cid)) savedCount++;
    const rec = records[cid];
    if (!rec) continue;
    const stage = toStage(rec.status);
    if (rec.contactedAt || stage === '연락 완료' || stage === '답변' || stage === '협업') {
      dm++;
      if (rec.contactedAt && (!latestContactedAt || rec.contactedAt > latestContactedAt)) {
        latestContactedAt = rec.contactedAt;
      }
    }
    if (stage === '답변') reply++;
    if (stage === '협업') collab++;
  }
  const activityAt = latestContactedAt ?? campaign.updatedAt;
  if (collab > 0) return { kind: 'collab', label: `협업 ${collab}건`, at: activityAt };
  if (reply > 0) return { kind: 'reply', label: `답변 ${reply}건`, at: activityAt };
  if (dm > 0) return { kind: 'dm', label: `DM ${dm}명 발송`, at: activityAt };
  if (savedCount > 0)
    return { kind: 'saved', label: `${savedCount}명 저장`, at: campaign.updatedAt };
  return {
    kind: 'search',
    label: campaign.status === 'failed' ? '검색 실패' : '검색 완료',
    at: campaign.createdAt,
  };
}
