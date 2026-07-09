import Link from 'next/link';

import { LoginForm } from '@/features/auth';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: '로그인' };

export default function LoginPage({ searchParams }: { searchParams: { redirectTo?: string } }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">다시 오신 걸 환영합니다</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          계정에 로그인해 오늘의 기회를 확인하세요.
        </p>
      </div>

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
