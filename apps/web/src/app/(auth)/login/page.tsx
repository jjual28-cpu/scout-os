import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

import { LoginForm } from '@/features/auth';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: '로그인' };

/** Maps /auth/callback error codes to a user-facing message. */
const ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed:
    '이메일 인증에 실패했습니다. 링크가 만료되었을 수 있어요. 다시 시도해 주세요.',
  auth_not_configured: '인증 기능이 아직 설정되지 않았습니다.',
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; error?: string };
}) {
  const errorMessage = searchParams.error
    ? (ERROR_MESSAGES[searchParams.error] ?? '인증 처리 중 문제가 발생했습니다.')
    : null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">다시 오신 걸 환영합니다</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          계정에 로그인해 오늘의 기회를 확인하세요.
        </p>
      </div>

      {errorMessage ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 flex items-start gap-2 rounded-md border p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <LoginForm redirectTo={searchParams.redirectTo} />

      <p className="text-muted-foreground mt-6 text-center text-sm">
        아직 계정이 없으신가요?{' '}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  );
}
