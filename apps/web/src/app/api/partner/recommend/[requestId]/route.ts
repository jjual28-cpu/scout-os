import { NextResponse, type NextRequest } from 'next/server';

import { isPartnerAuthorized } from '@/services/partner/auth';
import { getRecommend } from '@/services/partner/recommend';

export const dynamic = 'force-dynamic';
// May collect a finished Apify dataset + run the AI judge in this request.
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/partner/recommend/:requestId — Cellink polls every 10~15s. Each poll
 * advances the search server-side, so it progresses even with no browser open.
 *   200 { requestId, status, progress (0~1), error, creators }
 */
export async function GET(request: NextRequest, { params }: { params: { requestId: string } }) {
  if (!isPartnerAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!UUID_RE.test(params.requestId)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const result = await getRecommend(params.requestId);
    if (result === 'not_configured') {
      return NextResponse.json({ error: 'not_configured' }, { status: 503 });
    }
    if (!result) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[partner] recommend GET failed:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
