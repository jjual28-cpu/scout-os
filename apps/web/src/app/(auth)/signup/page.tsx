import Link from 'next/link';

import { SignupForm } from '@/features/auth';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: '회원가입' };

export default function SignupPage({ searchParams }: { searchParams: { redirectTo?: string } }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Scout OS 시작하기</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          몇 초면 충분합니다. AI 직원을 지금 채용하세요.
        </p>
      </div>

      <SignupForm redirectTo={searchParams.redirectTo} />

      <p className="text-muted-foreground mt-6 text-center text-sm">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          로그인
        </Link>
      </p>

      <p className="text-muted-foreground mt-4 text-center text-xs">
        가입하면 서비스 약관 및 개인정보 처리방침에 동의하는 것으로 간주됩니다.
      </p>
    </div>
  );
}
