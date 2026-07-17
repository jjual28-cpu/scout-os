import { type NextRequest } from 'next/server';

import { type InstagramCreator } from '@/features/search/instagram';
import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { matchCreators, type BrandContext } from '@/services/ai/match';
import {
  authorsFromPosts,
  getRunStatus,
  profilesFromItems,
  readDataset,
  SEARCH_MIN_SUFFICIENT,
  stage2Input,
  stage3Cap,
  stage3Input,
  startActorRun,
} from '@/services/apify/instagram';

export const dynamic = 'force-dynamic';
// Only reads a finished dataset + saves rows — never waits on an Apify run.
export const maxDuration = 60;

/** Matches the limit the Discover client sends (today's effective search target). */
const TARGET = 24;
/** A running campaign with no progress for this long is considered stale. */
const STALE_MS = 10 * 60 * 1000;

/** Stage → coarse progress %, derived (never stored in the DB). */
function progressFor(stage: number): number {
  if (stage <= 1) return 30;
  if (stage === 2) return 55;
  return 80;
}
function messageFor(stage: number): string {
  if (stage <= 1) return '프로필 수집 중';
  if (stage === 2) return '게시물 분석 중';
  return '상세 분석 중';
}
/** Running payload the client renders the stage tracker from. */
function runningBody(stage: number) {
  return {
    status: 'running' as const,
    stage,
    progress: progressFor(stage),
    message: messageFor(stage),
  };
}

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}
type Sb = Awaited<ReturnType<typeof getSupabase>>;

/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows / Apify items are loosely typed */

function creatorToRow(c: InstagramCreator, userId: string) {
  return {
    user_id: userId,
    platform: 'instagram',
    external_id: c.id,
    username: c.username,
    display_name: c.displayName,
    profile_url: c.profileUrl,
    profile_image_url: c.profileImageUrl,
    biography: c.biography,
    followers_count: c.followersCount,
    following_count: c.followingCount,
    posts_count: c.postsCount,
    is_verified: c.isVerified,
    category: c.category,
    raw_data: c.rawData,
  };
}

/** Persist creators for a campaign. Idempotent: the unique (user, campaign, creator)
 *  constraint + ignoreDuplicates make repeated/concurrent polls safe. */
async function saveCreators(
  sb: Sb,
  userId: string,
  campaignId: string,
  query: string,
  creators: InstagramCreator[],
  startRank: number,
): Promise<void> {
  if (creators.length === 0) return;

  const { error: dcError } = await sb.from('discovered_creators').upsert(
    creators.map((c) => creatorToRow(c, userId)),
    {
      onConflict: 'user_id,platform,external_id',
    },
  );
  if (dcError) console.error(`[status] discovered_creators upsert failed: ${dcError.message}`);

  const rows = creators.map((c, i) => ({
    user_id: userId,
    campaign_id: campaignId,
    creator_id: c.id,
    platform: 'instagram',
    rank: startRank + i + 1,
    search_keyword: query,
    creator_snapshot: {
      externalId: c.id,
      username: c.username,
      displayName: c.displayName,
      profileUrl: c.profileUrl,
      profileImageUrl: c.profileImageUrl,
      biography: c.biography,
      followersCount: c.followersCount,
      followingCount: c.followingCount,
      postsCount: c.postsCount,
      isVerified: c.isVerified,
      category: c.category,
    },
  }));
  const { error } = await sb
    .from('campaign_results')
    .upsert(rows, { onConflict: 'user_id,campaign_id,creator_id', ignoreDuplicates: true });
  if (error) {
    // Never mark succeeded when the snapshot didn't persist.
    throw new Error(`campaign_results 저장 실패: ${error.message}`);
  }
}

async function existingResults(
  sb: Sb,
  userId: string,
  campaignId: string,
): Promise<{ count: number; usernames: string[] }> {
  const { data } = await sb
    .from('campaign_results')
    .select('creator_id')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId);
  const ids = (data ?? []).map((r: any) => r.creator_id as string);
  return { count: ids.length, usernames: ids.map((id) => id.split(':')[1] ?? id) };
}

async function markFailed(sb: Sb, campaignId: string, message: string): Promise<void> {
  await sb
    .from('campaigns')
    .update({
      status: 'failed',
      error: message,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      apify_run_id: null, // releases the running-unique lock
    })
    .eq('id', campaignId)
    .eq('status', 'running');
}

/**
 * AI matching pass — runs ONCE, right before a campaign is marked succeeded.
 *
 * Apify only casts a wide net; this is where the results actually get judged
 * against the brand so info/irrelevant accounts drop out and real fits rank up.
 *
 * Deliberately best-effort: ANY failure (no AI key, daily cap reached, bad model
 * output) leaves the raw results untouched and the search still succeeds. The
 * search must never break because AI was unavailable.
 */
async function applyAiMatch(
  sb: Sb,
  userId: string,
  campaignId: string,
  query: string,
  productId: string | null,
): Promise<void> {
  try {
    const { data: rows } = await sb
      .from('campaign_results')
      .select('creator_id,creator_snapshot')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId);
    if (!rows || rows.length === 0) return;

    /* eslint-disable @typescript-eslint/no-explicit-any -- stored snapshots are jsonb */
    const creators = (rows as any[])
      .map((r) => r.creator_snapshot as any)
      .filter((s) => s && typeof s.username === 'string')
      .map(
        (s): InstagramCreator => ({
          id: s.externalId,
          platform: 'instagram',
          username: s.username,
          displayName: s.displayName ?? s.username,
          profileUrl: s.profileUrl ?? '',
          profileImageUrl: s.profileImageUrl ?? null,
          biography: s.biography ?? null,
          followersCount: s.followersCount ?? null,
          followingCount: s.followingCount ?? null,
          postsCount: s.postsCount ?? null,
          isVerified: Boolean(s.isVerified),
          category: s.category ?? null,
          rawData: null,
        }),
      );
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (creators.length === 0) return;

    // Brand context makes the verdict "fit for THIS product" instead of just
    // "on topic". Absent product → judge against the search intent only.
    let brand: BrandContext | null = null;
    if (productId) {
      const { data: p } = await sb
        .from('products')
        .select('name,brand,category,usp,selling_points,target')
        .eq('id', productId)
        .maybeSingle();
      if (p) {
        const row = p as Record<string, string | null>;
        brand = {
          productName: row.name,
          brand: row.brand,
          category: row.category,
          usp: row.usp,
          sellingPoints: row.selling_points,
          target: row.target,
        };
      }
    }

    const verdicts = await matchCreators(userId, query, creators, brand);
    if (verdicts.size === 0) return;

    // Persist per creator. Sequential updates keep it simple and are cheap at
    // ~24 rows; a failure on one row must not abort the rest.
    for (const c of creators) {
      const m = verdicts.get(c.username.toLowerCase());
      if (!m) continue;
      const { error } = await sb
        .from('campaign_results')
        .update({ ai_score: m.score, ai_verdict: m.verdict, ai_reason: m.reason })
        .eq('user_id', userId)
        .eq('campaign_id', campaignId)
        .eq('creator_id', c.id);
      if (error) console.error(`[status] ai verdict save failed (${c.username}): ${error.message}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[status] AI matching skipped for campaign ${campaignId}: ${msg}`);
  }
}

async function markSucceeded(sb: Sb, campaignId: string, count: number): Promise<void> {
  await sb
    .from('campaigns')
    .update({
      status: 'succeeded',
      result_count: count,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      apify_run_id: null,
    })
    .eq('id', campaignId)
    .eq('status', 'running');
}

/**
 * Conditional claim — only ONE concurrent poll may advance a stage, so the next
 * Actor is started exactly once even if the Discover poller and the global
 * poller both call this at the same moment.
 */
async function claimStage(
  sb: Sb,
  campaignId: string,
  fromStage: number,
  fromRunId: string,
  toStage: number,
): Promise<boolean> {
  const { data } = await sb
    .from('campaigns')
    .update({ apify_stage: toStage, apify_run_id: null, apify_dataset_id: null })
    .eq('id', campaignId)
    .eq('status', 'running')
    .eq('apify_stage', fromStage)
    .eq('apify_run_id', fromRunId)
    .select('id');
  return Boolean(data && data.length > 0);
}

async function attachRun(
  sb: Sb,
  campaignId: string,
  run: { runId: string; datasetId: string },
): Promise<void> {
  await sb
    .from('campaigns')
    .update({ apify_run_id: run.runId, apify_dataset_id: run.datasetId })
    .eq('id', campaignId)
    .eq('status', 'running');
}

/**
 * POST /api/campaigns/:campaignId/status — advance the async search.
 *
 * POST (not GET) because this MUTATES: it collects a finished Apify dataset,
 * persists results and starts the next stage. Plain reads go straight to
 * Supabase from the client. Safe under concurrent/duplicate polling via the
 * conditional stage claim + the campaign_results unique constraint.
 */
export const POST = withErrorHandling(
  async (_request: NextRequest, { params }: { params: { campaignId: string } }) => {
    const campaignId = params.campaignId;
    if (!isSupabaseConfigured()) return ok({ status: 'unavailable' as const });

    const sb = await getSupabase();
    const { data: auth } = await sb.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return ok({ status: 'unavailable' as const });

    const { data: row } = await sb
      .from('campaigns')
      .select(
        'id,query,status,error,result_count,apify_run_id,apify_dataset_id,apify_stage,started_at,product_id,search_mode',
      )
      .eq('id', campaignId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!row) return fail('NOT_FOUND', '캠페인을 찾을 수 없습니다.', 404);

    const c = row as any;
    if (c.status !== 'running') {
      return ok({
        status: c.status,
        resultCount: c.result_count ?? 0,
        error: c.error ?? null,
        progress: c.status === 'succeeded' ? 100 : 0,
      });
    }

    const curStage: number = c.apify_stage ?? 1;
    const startedMs = c.started_at ? new Date(c.started_at).getTime() : 0;
    const stale = startedMs > 0 && Date.now() - startedMs > STALE_MS;

    // A run isn't attached yet (POST or a stage claim is starting it right now).
    if (!c.apify_run_id) {
      if (stale) {
        const msg = '검색을 시작하지 못했습니다. 다시 검색해 주세요.';
        await markFailed(sb, campaignId, msg);
        return ok({ status: 'failed' as const, error: msg });
      }
      return ok(runningBody(curStage));
    }

    const run = await getRunStatus(c.apify_run_id);
    if (!run) {
      const msg = 'Apify 실행 정보를 조회할 수 없습니다. 다시 검색해 주세요.';
      await markFailed(sb, campaignId, msg);
      return ok({ status: 'failed' as const, error: msg });
    }
    if (run.status === 'READY' || run.status === 'RUNNING' || run.status === 'ABORTING') {
      // Still running — but if it's been stuck well past the expected time, give
      // up so the campaign never sits on "검색 중" forever (the browser poller may
      // have been paused for hours). A SUCCEEDED run is handled below and always
      // collected, so this only fails runs that genuinely never finished.
      if (stale) {
        const msg = '검색이 시간 내에 완료되지 않았습니다. 다시 검색해 주세요.';
        await markFailed(sb, campaignId, msg);
        return ok({ status: 'failed' as const, error: msg });
      }
      return ok(runningBody(curStage));
    }
    if (run.status !== 'SUCCEEDED') {
      const msg = `검색이 실패했습니다. (${run.status})`;
      await markFailed(sb, campaignId, msg);
      return ok({ status: 'failed' as const, error: msg });
    }

    // ── Run SUCCEEDED → collect this stage's dataset and advance ──────────────
    const datasetId: string | null = c.apify_dataset_id ?? run.datasetId;
    if (!datasetId) {
      const msg = '검색 결과 데이터셋을 찾을 수 없습니다. 다시 검색해 주세요.';
      await markFailed(sb, campaignId, msg);
      return ok({ status: 'failed' as const, error: msg });
    }

    const stage: number = c.apify_stage ?? 1;
    const query: string = c.query;
    const mode: 'keyword' | 'tagged' = c.search_mode === 'tagged' ? 'tagged' : 'keyword';

    try {
      const items = await readDataset(datasetId);

      // ── Tagged mode — the same 3-stage machine, two stages long ─────────────
      //    1 = posts tagging the brand → author usernames
      //    2 = enrich those authors → profiles → done
      if (mode === 'tagged') {
        if (stage === 1) {
          // The tagged actor returns POSTS; the value is who wrote them.
          const authors = authorsFromPosts(items, []).slice(0, stage3Cap(TARGET));
          if (authors.length === 0) {
            await markSucceeded(sb, campaignId, 0);
            return ok({ status: 'succeeded' as const, resultCount: 0, progress: 100 });
          }
          if (!(await claimStage(sb, campaignId, 1, c.apify_run_id, 2))) {
            return ok(runningBody(2));
          }
          const started = await startActorRun(stage3Input(authors));
          await attachRun(sb, campaignId, started);
          return ok(runningBody(2));
        }

        // Stage 2 — enriched profiles → save → judge → finish.
        const creators = profilesFromItems(items).slice(0, TARGET);
        await saveCreators(sb, userId, campaignId, query, creators, 0);
        const { count } = await existingResults(sb, userId, campaignId);
        // Tell the AI these came from tagging a brand — that's the signal.
        await applyAiMatch(
          sb,
          userId,
          campaignId,
          `@${query} 브랜드를 태그한 계정 (브랜드 협업 경험 있음)`,
          c.product_id ?? null,
        );
        await markSucceeded(sb, campaignId, count);
        return ok({ status: 'succeeded' as const, resultCount: count, progress: 100 });
      }

      // ── Keyword mode (unchanged) ───────────────────────────────────────────
      // Stage 1 — profile search results.
      if (stage === 1) {
        const creators = profilesFromItems(items).slice(0, TARGET);
        await saveCreators(sb, userId, campaignId, query, creators, 0);
        const { count } = await existingResults(sb, userId, campaignId);

        if (count >= Math.min(TARGET, SEARCH_MIN_SUFFICIENT)) {
          await applyAiMatch(sb, userId, campaignId, query, c.product_id ?? null);
          await markSucceeded(sb, campaignId, count);
          return ok({ status: 'succeeded' as const, resultCount: count, progress: 100 });
        }
        if (!(await claimStage(sb, campaignId, 1, c.apify_run_id, 2))) {
          return ok(runningBody(2)); // another poll won the claim
        }
        const started = await startActorRun(stage2Input(query));
        await attachRun(sb, campaignId, started);
        return ok(runningBody(2));
      }

      // Stage 2 — posts → author usernames → enrich.
      if (stage === 2) {
        const { count, usernames } = await existingResults(sb, userId, campaignId);
        const authors = authorsFromPosts(items, usernames);
        const toEnrich = authors.slice(0, stage3Cap(Math.max(TARGET - count, 0)));

        if (toEnrich.length === 0) {
          await applyAiMatch(sb, userId, campaignId, query, c.product_id ?? null);
          await markSucceeded(sb, campaignId, count);
          return ok({ status: 'succeeded' as const, resultCount: count, progress: 100 });
        }
        if (!(await claimStage(sb, campaignId, 2, c.apify_run_id, 3))) {
          return ok(runningBody(3));
        }
        const started = await startActorRun(stage3Input(toEnrich));
        await attachRun(sb, campaignId, started);
        return ok(runningBody(3));
      }

      // Stage 3 — enriched profile details → finish.
      const { count: before } = await existingResults(sb, userId, campaignId);
      const room = Math.max(TARGET - before, 0);
      await saveCreators(
        sb,
        userId,
        campaignId,
        query,
        profilesFromItems(items).slice(0, room),
        before,
      );
      const { count } = await existingResults(sb, userId, campaignId);
      await applyAiMatch(sb, userId, campaignId, query, c.product_id ?? null);
      await markSucceeded(sb, campaignId, count);
      return ok({ status: 'succeeded' as const, resultCount: count, progress: 100 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '검색 처리 중 오류가 발생했습니다.';
      console.error(`[status] campaign ${campaignId} stage ${stage} failed: ${msg}`);
      await markFailed(sb, campaignId, msg);
      return ok({ status: 'failed' as const, error: msg });
    }
  },
);
