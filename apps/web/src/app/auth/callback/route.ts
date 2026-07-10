import { NextResponse, type NextRequest } from 'next/server';

import { isSupabaseConfigured } from '@/lib/env';

// Never evaluated at build — env is read and the Supabase client is created only
// when a real request arrives (lazy initialization).
export const dynamic = 'force-dynamic';

/**
 * Supabase auth callback. Email-confirmation and OAuth links redirect here with
 * a `code` that we exchange for a session cookie, then forward the user on.
 * Referenced by `supabase/config.toml → auth.additional_redirect_urls`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  // Mock mode: no Supabase → nothing to exchange, just send the user home.
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=auth_not_configured`);
  }

  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirectTo') ?? '/discover';

  if (code) {
    // Import the server client lazily so this module never constructs it at build.
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
