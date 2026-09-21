import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { env, isSupabaseConfigured } from '@/lib/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Refreshes the Supabase auth session on every request and guards protected
 * routes. Called from the root `middleware.ts`.
 */
export async function updateSession(request: NextRequest) {
  // The dashboard home is /home. The old Prisma scaffold /dashboard redirects there.
  const { pathname } = request.nextUrl;

  // 호스트 정규화: www.scout-os.kr → scout-os.kr (페이지 라우트만).
  // 인스타 OAuth 는 apex(scout-os.kr) redirect_uri 로 고정돼 있어, 사용자가 www 로 들어오면
  // 시작(www)과 콜백(apex)이 갈려 state·세션 쿠키가 안 맞아 조용히 실패한다(비즈니스 인증 때
  // apex 직접서빙으로 바뀌며 드러난 문제). 페이지를 apex 로 넘겨 사용자가 항상 apex 에서
  // 클릭하게 하면 흐름이 한 호스트로 정렬돼, www 로 들어와도 그대로 연결된다.
  // /api/* 는 제외 — Meta 웹훅·데이터삭제 콜백이 어느 호스트로 오든 리다이렉트 없이 처리돼야 함.
  const host = request.headers.get('host')?.toLowerCase() ?? '';
  if (host === 'www.scout-os.kr' && !pathname.startsWith('/api/')) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.hostname = 'scout-os.kr';
    url.port = '';
    return NextResponse.redirect(url, 308);
  }
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }

  // Mock mode: without Supabase we skip auth entirely and never touch a client,
  // so every page (including /discover, /search, /saved, /outreach) renders.
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup');
  // When Supabase is configured, the app requires login. (In mock mode we return
  // early above, so these routes stay public and run on localStorage.)
  const isProtected =
    pathname.startsWith('/home') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/ai-employee') ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/discover') ||
    pathname.startsWith('/trends') ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/saved') ||
    pathname.startsWith('/outreach') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/discovery') ||
    pathname.startsWith('/crm') ||
    pathname.startsWith('/creators') ||
    pathname.startsWith('/campaigns') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings');

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }

  return response;
}
