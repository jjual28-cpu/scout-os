import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

import { env } from '@/lib/env';

/**
 * `Authorization: Bearer <CELLINK_PARTNER_KEY>` check for the partner API.
 * Constant-time (hash both sides so lengths never leak). No key configured →
 * every request is rejected, so a deploy without the env stays closed.
 */
export function isPartnerAuthorized(header: string | null): boolean {
  const expected = env.CELLINK_PARTNER_KEY;
  if (!expected || !header) return false;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return false;
  const a = createHash('sha256').update(m[1]!.trim()).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
