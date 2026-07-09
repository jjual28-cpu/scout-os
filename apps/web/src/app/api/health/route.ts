import { ok } from '@/lib/api/response';

/** GET /api/health — lightweight liveness probe. */
export function GET() {
  return ok({ status: 'ok', service: 'scout-os-web', time: new Date().toISOString() });
}
