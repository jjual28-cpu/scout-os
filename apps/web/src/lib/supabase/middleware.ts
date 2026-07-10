import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { env, isSupabaseConfigured } from '@/lib/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Refreshes the Supabase auth session on every request and guards protected
 * routes. Called from the root `middleware.ts`.
 */
export async function updateSession(request: NextRequest) {
  // Discover — not a dashboard — is the main entry point of Scout OS. Any visit
  // to /dashboard is redirected to /discover.
  const { pathname } = request.nextUrl;
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/discover';
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
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/discovery') ||
    pathname.startsWith('/crm') ||
    pathname.startsWith('/creators') ||
    pathname.startsWith('/campaigns') ||
    pathname.startsWith('/settings');

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/discover';
    return NextResponse.redirect(url);
  }

  return response;
}
