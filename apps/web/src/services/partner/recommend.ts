import 'server-only';

import { type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { aiErrorMessage } from '@/services/ai/errors';
import { type MatchExtras, type SearchTarget } from '@/services/ai/match';
import { planSearch, type SearchPlan } from '@/services/ai/query';
import { getRunStatus, stage1Input, stage2Input, startActorRun } from '@/services/apify/instagram';
import { advanceCampaign, progressFor, rejectForTarget } from '@/services/campaigns/advance';

import { brandContextFor, cacheKeyFor, mergeHashtags, partnerContextBlock } from './context';
import { type RecommendedCreator, type RecommendRequest } from './schema';
import { selectRecommended, type JudgedRow } from './select';

/**
 * Cellink partner API — the server-to-server twin of the Discover search.
 *
 * Every Cellink search is a normal Scout OS campaign owned by ONE service user
 * (CELLINK_SERVICE_USER_ID) and started with the same overlap Apify flow as
 * Discover. Progress is driven by the GET poll: the server (service role) calls
 * the same state machine the browser poller calls, so no client has to poll
 * Scout OS directly. One `partner_requests` row per request records the mall,
 * the cache key and whether it started a paid Apify run (→ monthly cap).
 */

const PARTNER = 'cellink';
/** Mall-shared cache window for a finished search (same cache key). */
const CACHE_WINDOW_MS = 72 * 60 * 60 * 1000;
/** Contract: a search not done within 10 minutes is failed. Matches STALE_MS. */
const TIMEOUT_MS = 10 * 60 * 1000;
/** Minimum gap between two server-side advances of the same campaign. */
const ADVANCE_CLAIM_MS = 30 * 1000;
/** Stage-1 name search size (stage1Input caps it at 16 anyway). */
const STAGE1_LIMIT = 30;

type Admin = SupabaseClient;

export type StartResult =
  | { kind: 'cached' | 'running'; requestId: string }
  | { kind: 'limit_exceeded' }
  | { kind: 'not_configured' }
  | { kind: 'start_failed'; requestId: string; message: string };

export type RecommendStatus = {
  requestId: string;
  status: 'running' | 'succeeded' | 'failed';
  progress: number;
  error: string | null;
  creators: RecommendedCreator[];
};

/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows are loosely typed here */

function serviceContext(): { admin: Admin; userId: string } | null {
  const userId = env.CELLINK_SERVICE_USER_ID;
  if (!userId || !env.APIFY_API_TOKEN) return null;
  try {
    return { admin: createAdminClient(), userId };
  } catch {
    return null;
  }
}

/** First instant of the current month in Asia/Seoul, as an ISO string. */
export function monthStartKst(now = Date.now()): string {
  const kst = new Date(now + 9 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000,
  ).toISOString();
}

/** What the judge reads for this search — rebuilt from the campaign's stored input. */
function extrasFromPlan(plan: any): MatchExtras {
  const input = plan?.partner?.input as RecommendRequest | undefined;
  if (!input) return { withPosts: true };
  return { brand: brandContextFor(input), context: partnerContextBlock(input), withPosts: true };
}

/**
 * A same-key search we can hand out instead of starting Apify again:
 * a finished one (≤72h, AI judged without error, has results) → cached, or a
 * fresh in-flight one → join it.
 */
async function findReusable(
  admin: Admin,
  userId: string,
  cacheKey: string,
): Promise<{ campaignId: string; status: 'succeeded' | 'running' } | null> {
  const since = new Date(Date.now() - CACHE_WINDOW_MS).toISOString();
  const { data: reqs } = await admin
    .from('partner_requests')
    .select('campaign_id')
    .eq('partner', PARTNER)
    .eq('cache_key', cacheKey)
    .not('campaign_id', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10);
  const ids = [...new Set(((reqs as any[] | null) ?? []).map((r) => r.campaign_id as string))];
  if (ids.length === 0) return null;

  const { data: camps } = await admin
    .from('campaigns')
    .select('id,status,started_at,completed_at,ai_error,result_count')
    .eq('user_id', userId)
    .in('id', ids);
  const byId = new Map(((camps as any[] | null) ?? []).map((c) => [c.id as string, c]));
  const freshRunning = Date.now() - TIMEOUT_MS;
  for (const id of ids) {
    const c = byId.get(id);
    if (!c) continue;
    if (
      c.status === 'succeeded' &&
      !c.ai_error &&
      (c.result_count ?? 0) > 0 &&
      c.completed_at &&
      Date.parse(c.completed_at) >= Date.parse(since)
    ) {
      return { campaignId: id, status: 'succeeded' };
    }
    if (c.status === 'running' && c.started_at && Date.parse(c.started_at) >= freshRunning) {
      return { campaignId: id, status: 'running' };
    }
  }
  return null;
}

async function insertRequest(
  admin: Admin,
  input: RecommendRequest,
  cacheKey: string,
  fields: { campaignId: string | null; cached: boolean; apifyStarted: boolean; status: string },
): Promise<string> {
  const { data, error } = await admin
    .from('partner_requests')
    .insert({
      partner: PARTNER,
      mall_id: input.mallId,
      org_id: input.orgId ?? null,
      campaign_id: fields.campaignId,
      cache_key: cacheKey,
      cached: fields.cached,
      apify_started: fields.apifyStarted,
      input,
      status: fields.status,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`partner_requests 저장 실패: ${error?.message ?? 'no row'}`);
  return (data as { id: string }).id;
}

async function failCampaign(admin: Admin, campaignId: string, message: string): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from('campaigns')
    .update({
      status: 'failed',
      error: message,
      completed_at: now,
      updated_at: now,
      apify_run_id: null, // releases the running-unique lock
    })
    .eq('id', campaignId)
    .eq('status', 'running');
}

/** POST /api/partner/recommend — reuse, cap, or start a new search. */
export async function startRecommend(input: RecommendRequest): Promise<StartResult> {
  const ctx = serviceContext();
  if (!ctx) return { kind: 'not_configured' };
  const { admin, userId } = ctx;
  const cacheKey = cacheKeyFor(input);
  const target: SearchTarget = input.target === 'gonggu' ? 'gonggu' : 'creator';

  // 1) Same search finished (≤72h) or in flight → no Apify, not counted.
  const reusable = await findReusable(admin, userId, cacheKey);
  if (reusable) {
    const requestId = await insertRequest(admin, input, cacheKey, {
      campaignId: reusable.campaignId,
      cached: reusable.status === 'succeeded',
      apifyStarted: false,
      status: 'running', // the GET resolves it (cached → succeeded on first read)
    });
    return { kind: reusable.status === 'succeeded' ? 'cached' : 'running', requestId };
  }

  // 2) Monthly cap across all of Cellink — only requests that started Apify count.
  const { count } = await admin
    .from('partner_requests')
    .select('*', { count: 'exact', head: true })
    .eq('partner', PARTNER)
    .eq('apify_started', true)
    .gte('created_at', monthStartKst());
  if ((count ?? 0) >= env.CELLINK_MONTHLY_LIMIT) return { kind: 'limit_exceeded' };

  // 3) A new campaign owned by the service user. The key suffix keeps two
  //    different searches on the same words apart under campaigns_one_running_uniq.
  //    Dead runs nobody polled anymore would hold that lock — fail them first
  //    (same rule as Discover's failStaleRunning).
  const kw = input.keywords;
  const query = `${kw.join(', ')} #${cacheKey.slice(0, 8)}`;
  const now = new Date().toISOString();
  await admin
    .from('campaigns')
    .update({
      status: 'failed',
      error: '검색이 시간 내에 끝나지 않아 자동 종료됐어요.',
      completed_at: now,
      updated_at: now,
      apify_run_id: null,
    })
    .eq('user_id', userId)
    .eq('status', 'running')
    .lt('started_at', new Date(Date.now() - TIMEOUT_MS).toISOString());
  const { data: created, error: insertErr } = await admin
    .from('campaigns')
    .insert({
      user_id: userId,
      query,
      title: `[셀링크 ${input.mallId}] ${kw.join(', ')}`,
      platform: 'instagram',
      status: 'running',
      result_count: 0,
      brand: input.brandProfile?.summary ?? null,
      goal: input.productName,
      memo: `cellink mallId=${input.mallId} orgId=${input.orgId ?? '-'}`,
      label: 'active',
      source: 'manual',
      search_mode: 'keyword',
      search_target: target,
      started_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (insertErr || !created) {
    // 23505: the exact same search started a moment ago → join it.
    if ((insertErr as any)?.code === '23505') {
      const again = await findReusable(admin, userId, cacheKey);
      if (again) {
        const requestId = await insertRequest(admin, input, cacheKey, {
          campaignId: again.campaignId,
          cached: again.status === 'succeeded',
          apifyStarted: false,
          status: 'running',
        });
        return { kind: again.status === 'succeeded' ? 'cached' : 'running', requestId };
      }
    }
    throw new Error(`캠페인 생성 실패: ${insertErr?.message ?? 'no row'}`);
  }
  const campaignId = (created as { id: string }).id;
  const requestId = await insertRequest(admin, input, cacheKey, {
    campaignId,
    cached: false,
    apifyStarted: true,
    status: 'running',
  });

  // 4) Search plan — the AI sees the brand profile, product, filters and notes
  //    so its hashtags reach this brand's customers. A plan always exists (falls
  //    back to the raw keywords) so the state machine never sees the key suffix.
  const brand = brandContextFor(input);
  const context = partnerContextBlock(input);
  let plan: SearchPlan = {
    searchTerm: kw[0]!,
    hashtags: mergeHashtags(kw, undefined),
    intent: `${kw.join(', ')} — ${input.productName}`,
  };
  try {
    const ai = await planSearch(userId, kw.join(', '), brand, target, context);
    if (ai) {
      plan = {
        searchTerm: ai.searchTerm || kw[0]!,
        hashtags: mergeHashtags(kw, ai.hashtags),
        intent: ai.intent || plan.intent,
      };
    }
  } catch (err) {
    console.error(`[partner] planSearch failed (campaign ${campaignId}): ${String(err)}`);
    await admin
      .from('campaigns')
      .update({ ai_error: aiErrorMessage(err) })
      .eq('id', campaignId);
  }

  // The judge rebuilds its context from this (excludeUsernames can be long and
  // never changes WHO is fit, so it isn't stored here).
  const storedInput: RecommendRequest = {
    ...input,
    filters: input.filters ? { ...input.filters, excludeUsernames: null } : input.filters,
  };

  // 5) Same overlap flow as Discover: hashtag posts + name search in parallel.
  try {
    const [tagStarted, nameStarted] = await Promise.all([
      // Fallback expansion (empty hashtags) must see the raw keyword, not the key suffix.
      startActorRun(stage2Input(kw[0]!, plan.hashtags)),
      startActorRun(stage1Input(plan.searchTerm, STAGE1_LIMIT)),
    ]);
    await admin
      .from('campaigns')
      .update({
        apify_run_id: tagStarted.runId,
        apify_dataset_id: tagStarted.datasetId,
        apify_stage: 1,
        search_plan: {
          ...plan,
          flow: 'overlap',
          nameRun: { runId: nameStarted.runId, datasetId: nameStarted.datasetId },
          partner: {
            cacheKey,
            mallId: input.mallId,
            orgId: input.orgId ?? null,
            input: storedInput,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
      .eq('status', 'running');
  } catch (err) {
    const message = err instanceof Error ? err.message : '검색을 시작하지 못했습니다.';
    console.error(`[partner] Apify run start failed (campaign ${campaignId}): ${message}`);
    await failCampaign(admin, campaignId, message);
    await admin
      .from('partner_requests')
      .update({
        status: 'failed',
        error: message,
        apify_started: false, // nothing ran → doesn't count toward the cap
        completed_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    return { kind: 'start_failed', requestId, message };
  }

  return { kind: 'running', requestId };
}

async function finishRequest(
  admin: Admin,
  requestId: string,
  patch: { status: 'succeeded' | 'failed'; error?: string | null; result?: RecommendedCreator[] },
): Promise<void> {
  await admin
    .from('partner_requests')
    .update({
      status: patch.status,
      error: patch.error ?? null,
      result: patch.result ?? null,
      result_count: patch.result?.length ?? 0,
      completed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'running');
}

/**
 * One poll at a time advances a campaign. Collecting a dataset + AI judging can
 * take ~30s while Cellink polls every 10~15s (and several malls can share one
 * cached search) — without this, overlapping polls would judge twice. The
 * claim is a conditional touch of updated_at; a poll that loses just reports
 * progress and the next one tries again.
 */
async function claimAdvance(admin: Admin, campaignId: string): Promise<boolean> {
  const now = Date.now();
  const { data } = await admin
    .from('campaigns')
    .update({ updated_at: new Date(now).toISOString() })
    .eq('id', campaignId)
    .eq('status', 'running')
    .lt('updated_at', new Date(now - ADVANCE_CLAIM_MS).toISOString())
    .select('id');
  return Boolean(data && data.length > 0);
}

const failedBody = (requestId: string, error: string): RecommendStatus => ({
  requestId,
  status: 'failed',
  progress: 0,
  error,
  creators: [],
});

/**
 * GET /api/partner/recommend/:id — advance the search one step (server-side)
 * and report. Null when the request doesn't exist. `notConfigured` when the
 * service user / service role is missing.
 */
export async function getRecommend(
  requestId: string,
): Promise<RecommendStatus | null | 'not_configured'> {
  const ctx = serviceContext();
  if (!ctx) return 'not_configured';
  const { admin, userId } = ctx;

  const { data: req } = await admin
    .from('partner_requests')
    .select('id,campaign_id,status,error,result,input,created_at')
    .eq('partner', PARTNER)
    .eq('id', requestId)
    .maybeSingle();
  if (!req) return null;
  const r = req as any;

  if (r.status === 'succeeded') {
    return {
      requestId,
      status: 'succeeded',
      progress: 1,
      error: null,
      creators: (r.result as RecommendedCreator[] | null) ?? [],
    };
  }
  if (r.status === 'failed') return failedBody(requestId, r.error ?? '검색에 실패했어요.');
  if (!r.campaign_id) {
    const msg = '검색 정보를 찾을 수 없어요. 다시 시도해 주세요.';
    await finishRequest(admin, requestId, { status: 'failed', error: msg });
    return failedBody(requestId, msg);
  }

  const loadCampaign = async () => {
    const { data } = await admin
      .from('campaigns')
      .select('id,status,error,ai_error,apify_stage,apify_run_id,started_at,search_plan')
      .eq('id', r.campaign_id)
      .eq('user_id', userId)
      .maybeSingle();
    return data as any;
  };

  let camp = await loadCampaign();
  if (!camp) {
    const msg = '검색 정보를 찾을 수 없어요. 다시 시도해 주세요.';
    await finishRequest(admin, requestId, { status: 'failed', error: msg });
    return failedBody(requestId, msg);
  }

  if (camp.status === 'running' && (await claimAdvance(admin, camp.id))) {
    try {
      // Apify run state before advancing (READY = queued on Apify's side, RUNNING = scraping)
      // — logged so a slow search can be told apart from a stuck poller.
      const run = camp.apify_run_id ? await getRunStatus(camp.apify_run_id) : null;
      const body = await advanceCampaign(admin, userId, camp.id, {
        ai: extrasFromPlan(camp.search_plan),
      });
      console.info(
        `[partner] advance campaign=${camp.id} stage=${camp.apify_stage} apify=${run?.status ?? '-'} → ${
          'notFound' in body ? 'not_found' : body.status
        }`,
      );
    } catch (err) {
      // A transient Apify/AI hiccup must not fail the request — the next poll retries.
      console.error(`[partner] advance failed (campaign ${camp.id}): ${String(err)}`);
    }
    camp = (await loadCampaign()) ?? camp;
  }

  if (camp.status === 'running') {
    const age = Date.now() - Date.parse(r.created_at);
    if (age > TIMEOUT_MS) {
      const msg = '검색이 10분 안에 끝나지 않아 종료했어요. 다시 시도해 주세요.';
      const started = camp.started_at ? Date.parse(camp.started_at) : 0;
      if (Date.now() - started > TIMEOUT_MS) await failCampaign(admin, camp.id, msg);
      await finishRequest(admin, requestId, { status: 'failed', error: msg });
      return failedBody(requestId, msg);
    }
    return {
      requestId,
      status: 'running',
      progress: progressFor(camp.apify_stage ?? 1) / 100,
      error: null,
      creators: [],
    };
  }

  if (camp.status !== 'succeeded') {
    const msg = camp.error ?? '검색에 실패했어요. 다시 시도해 주세요.';
    await finishRequest(admin, requestId, { status: 'failed', error: msg });
    return failedBody(requestId, msg);
  }
  if (camp.ai_error) {
    // Without a verdict nothing is vouched for — never hand out unjudged accounts.
    const msg = `AI 판정을 완료하지 못했어요. 잠시 후 다시 시도해 주세요. (${camp.ai_error})`;
    await finishRequest(admin, requestId, { status: 'failed', error: msg });
    return failedBody(requestId, msg);
  }

  const { data: rows, error: rowsErr } = await admin
    .from('campaign_results')
    .select('creator_snapshot,ai_score,ai_verdict,ai_reason,ai_evidence')
    .eq('user_id', userId)
    .eq('campaign_id', camp.id);
  if (rowsErr) throw new Error(`campaign_results 조회 실패: ${rowsErr.message}`);

  const input = r.input as RecommendRequest;
  const creators = selectRecommended((rows as JudgedRow[] | null) ?? [], {
    target: input.target === 'gonggu' ? 'gonggu' : 'creator',
    filters: input.filters,
    limit: input.limit ?? 10,
    reject: rejectForTarget,
  });
  await finishRequest(admin, requestId, { status: 'succeeded', result: creators });
  return { requestId, status: 'succeeded', progress: 1, error: null, creators };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
