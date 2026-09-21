import 'server-only';

import { type NextRequest } from 'next/server';

import { env } from '@/lib/env';

/**
 * 인스타 OAuth 흐름에서 쓸 앱 origin — **사용자가 실제 접속한 호스트를 그대로** 쓴다.
 *
 * 왜: redirect_uri·state 쿠키·복귀 URL을 전부 한 고정 호스트(NEXT_PUBLIC_APP_URL=apex)로
 * 잡으면, 사용자가 www 로 접속했을 때 시작(www)과 콜백(apex)이 달라져 state·세션 쿠키가
 * 서로 안 보여 조용히 실패한다(비즈니스 인증 때 apex 직접서빙으로 바뀌며 생긴 문제).
 * 접속 호스트를 그대로 쓰면 시작·콜백이 같은 호스트라 쿠키가 항상 일치한다.
 *
 * 보안: 허용 호스트 화이트리스트에 있을 때만 그 호스트를 쓰고(오픈리다이렉트 방지),
 * 아니면(로컬·프리뷰) NEXT_PUBLIC_APP_URL 로 폴백한다.
 *
 * ⚠️ Meta 앱의 'Valid OAuth Redirect URIs' 에 두 호스트의 콜백이 **모두** 등록돼 있어야 한다:
 *   https://scout-os.kr/api/instagram/callback
 *   https://www.scout-os.kr/api/instagram/callback
 */
const ALLOWED_HOSTS = new Set(['scout-os.kr', 'www.scout-os.kr']);

export function appOrigin(request: NextRequest): string {
  const host = request.headers.get('host')?.toLowerCase().trim() ?? '';
  if (ALLOWED_HOSTS.has(host)) return `https://${host}`;
  return env.NEXT_PUBLIC_APP_URL;
}
