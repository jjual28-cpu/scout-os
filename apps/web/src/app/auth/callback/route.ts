import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { isSupabaseConfigured } from '@/lib/env';

// Never evaluated at build — env is read and the Supabase client is created only
// when a real request arrives (lazy initialization).
export const dynamic = 'force-dynamic';

const OTP_TYPES: EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

/**
 * Supabase auth callback for email-confirmation and OAuth links.
 *
 * Two link shapes are supported so confirmation works on ANY device/browser:
 *   1. token_hash + type  → verifyOtp  (device-independent — the correct flow for
 *      email confirmation. No PKCE verifier needed, so opening the email link in a
 *      different browser than signup — the norm on mobile — still works.)
 *   2. code               → exchangeCodeForSession (PKCE; used by OAuth, and only
 *      works in the same browser that started the flow).
 *
 * The email template MUST use the token_hash link (see Supabase → Email Templates):
 *   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=auth_not_configured`);
  }

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const redirectTo = searchParams.get('redirectTo') ?? searchParams.get('next') ?? '/home';

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = createClient();

  // 1) token_hash flow (email confirmation) — works on any device.
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  // 2) code flow (OAuth / same-browser PKCE).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
