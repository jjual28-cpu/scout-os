'use client';

import { Search, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

import { useSubscription } from '../hooks/use-subscription';

/**
 * 이번 달 잔여 검색을 상시 노출한다. 로그인 + Supabase 구성일 때만(그 외엔 숨김 —
 * mock/로그아웃에 "무료 1회"를 띄우면 오히려 오해를 준다).
 *
 * 넛지(업그레이드 유도)는 과하지 않게:
 *  - 소진(0): "다 썼어요" + 업그레이드
 *  - 유료 임박(≤10%): 넛지
 *  - 무료는 1회를 아직 안 쓴 상태를 조르지 않는다 → 여유 표시만.
 */
export function SearchQuota() {
  const { plan, used, hydrated, signedIn } = useSubscription();
  if (!hydrated || !signedIn) return null;

  const total = plan.monthlySearches;
  const remaining = Math.max(total - used, 0);
  const canUpgrade = plan.key !== 'pro';
  const low = remaining === 0 || (total >= 10 && remaining <= Math.ceil(total * 0.1));

  if (!low) {
    return (
      <div className="text-muted-foreground mb-4 inline-flex items-center gap-1.5 text-xs">
        <Search className="size-3.5" />
        {plan.name} · 이번 달 검색{' '}
        <span className="text-foreground font-medium">{remaining}회</span> 남음
      </div>
    );
  }

  return (
    <div className="border-primary/30 bg-primary/[0.06] mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border p-3">
      <span className="text-sm font-medium">
        {remaining === 0
          ? `${plan.name} 플랜 이번 달 검색을 다 썼어요`
          : `이번 달 검색이 ${remaining}회 남았어요`}
      </span>
      {canUpgrade ? (
        <Button asChild size="sm" className="ml-auto">
          <Link href="/settings">
            <Sparkles className="size-4" />
            업그레이드
          </Link>
        </Button>
      ) : (
        <span className="text-muted-foreground ml-auto text-xs">매월 1일 초기화</span>
      )}
    </div>
  );
}
