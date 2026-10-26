import { NextResponse, type NextRequest } from 'next/server';

import { isPartnerAuthorized } from '@/services/partner/auth';
import { startRecommend } from '@/services/partner/recommend';
import { recommendRequestSchema } from '@/services/partner/schema';

// Env is read and Supabase/Apify clients are created only per request.
export const dynamic = 'force-dynamic';
// Every fetch here (Supabase, Apify, AI) must hit the network — Next 14's Data
// Cache otherwise replays the first response and the search never advances.
export const fetchCache = 'force-no-store';
// Starts the Apify runs and returns — never waits for the scrape.
export const maxDuration = 60;

/**
 * POST /api/partner/recommend — Cellink asks for influencer recommendations.
 *
 * Plain JSON (not the app's {data} envelope) — the shape is fixed by the
 * Cellink ↔ Scout OS contract (cellink/docs/plans/2026-10-26-scout-os-partner-api.md):
 *   202 { requestId, status: 'running', cached: false }
 *   200 { requestId, status: 'succeeded', cached: true }
 *   401 { error: 'unauthorized' } · 400 { error: 'invalid_request' } · 429 { error: 'limit_exceeded' }
 */
export async function POST(request: NextRequest) {
  if (!isPartnerAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = recommendRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await startRecommend(parsed.data);
    switch (result.kind) {
      case 'cached':
        return NextResponse.json(
          { requestId: result.requestId, status: 'succeeded', cached: true },
          { status: 200 },
        );
      case 'running':
        return NextResponse.json(
          { requestId: result.requestId, status: 'running', cached: false },
          { status: 202 },
        );
      case 'limit_exceeded':
        return NextResponse.json({ error: 'limit_exceeded' }, { status: 429 });
      case 'not_configured':
        return NextResponse.json({ error: 'not_configured' }, { status: 503 });
      case 'start_failed':
        return NextResponse.json(
          { error: 'start_failed', requestId: result.requestId, message: result.message },
          { status: 502 },
        );
    }
  } catch (err) {
    console.error('[partner] recommend POST failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
