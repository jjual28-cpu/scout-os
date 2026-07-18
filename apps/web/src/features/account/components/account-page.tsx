'use client';

import { CreditCard, LogOut, Settings, User } from 'lucide-react';
import Link from 'next/link';

import { SectionCard } from '@/components/layout/blocks';
import { PageHeader } from '@/components/layout/page-header';
import { useCurrentUser } from '@/components/layout/use-current-user';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth';
import { useSubscription } from '@/features/billing/hooks/use-subscription';
import { isSupabaseConfigured } from '@/lib/env';

/** 마이페이지 — 내 계정 정보와 플랜 요약. 플랜 변경/결제는 설정으로 이어진다. */
export function AccountPage() {
  const { name, email } = useCurrentUser();
  const sub = useSubscription();
  const { signOut } = useAuth();
  const initials = (name ?? email ?? 'SC').slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader title="마이페이지" description="내 계정과 플랜을 확인해요." />

      <SectionCard title="내 계정" icon={<User className="size-4" />}>
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium">{name ?? '내 계정'}</p>
            {email ? (
              <p className="text-muted-foreground truncate text-sm">{email}</p>
            ) : (
              <p className="text-muted-foreground text-sm">로그인 정보를 불러오는 중…</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="플랜" icon={<CreditCard className="size-4" />}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{sub.plan.name}</p>
            <p className="text-muted-foreground text-sm">
              이번 달 검색 {sub.used} / {sub.plan.monthlySearches}회
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">
              <Settings className="size-4" />
              플랜 관리
            </Link>
          </Button>
        </div>
      </SectionCard>

      {isSupabaseConfigured() ? (
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut className="size-4" />
          로그아웃
        </Button>
      ) : null}
    </div>
  );
}
