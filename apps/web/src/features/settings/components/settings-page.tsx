'use client';

import { CheckCircle2, CreditCard, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { SectionCard, StatusBadge } from '@/components/layout/blocks';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/features/billing/hooks/use-subscription';
import { formatPrice, PLAN_ORDER, PLANS } from '@/features/billing/plans';
import { cn } from '@/lib/utils';

import { useAiUsage } from '../hooks/use-ai-usage';

type TestState = { kind: 'idle' | 'ok' | 'fail'; message?: string };

export function SettingsPage() {
  const { usage, loading, reload } = useAiUsage();
  const sub = useSubscription();
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });

  const pct = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const remaining = Math.max(usage.limit - usage.used, 0);
  const searchPct =
    sub.plan.monthlySearches > 0
      ? Math.min(100, Math.round((sub.used / sub.plan.monthlySearches) * 100))
      : 0;

  async function runTest() {
    setTest({ kind: 'idle' });
    setBusy(true);
    try {
      const res = await fetch('/api/ai/test', { method: 'POST' });
      const json = (await res.json().catch(() => null)) as {
        data?: { sample?: string };
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        setTest({ kind: 'fail', message: json?.error?.message ?? '테스트에 실패했습니다.' });
        return;
      }
      setTest({ kind: 'ok', message: json?.data?.sample || '정상 응답을 받았습니다.' });
      await reload();
    } catch {
      setTest({ kind: 'fail', message: '테스트 중 문제가 발생했습니다.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader title="설정" description="플랜·AI 사용량과 기본 작업 환경을 관리합니다." />

      <SectionCard
        title="플랜"
        icon={<CreditCard className="size-4" />}
        action={<StatusBadge tone="primary">{sub.plan.name}</StatusBadge>}
      >
        {!sub.hydrated ? (
          <p className="text-muted-foreground text-sm">불러오는 중…</p>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-medium">이번 달 검색</span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {sub.used} / {sub.plan.monthlySearches}회
                </span>
              </div>
              <div className="dark:bg-muted h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    searchPct >= 100 ? 'bg-destructive' : 'bg-primary',
                  )}
                  style={{ width: `${searchPct}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs">
                현재 <span className="text-foreground font-medium">{sub.plan.name}</span>{' '}
                플랜이에요.
                {sub.signedIn ? '' : ' 로그인하면 내 플랜이 표시돼요.'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {PLAN_ORDER.map((k) => {
                const p = PLANS[k];
                const current = p.key === sub.plan.key;
                return (
                  <div
                    key={k}
                    className={cn(
                      'rounded-xl border p-3',
                      current
                        ? 'border-primary bg-primary/5'
                        : 'dark:border-border border-slate-200',
                    )}
                  >
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-muted-foreground text-xs">{p.tagline}</p>
                    <p className="mt-1.5 text-sm font-medium">
                      {formatPrice(p.priceMonthly)}
                      {p.priceMonthly > 0 ? (
                        <span className="text-muted-foreground text-xs font-normal">/월</span>
                      ) : null}
                    </p>
                    {current ? (
                      <p className="text-primary mt-1 text-[11px] font-medium">현재 플랜</p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div>
              <Button variant="outline" size="sm" disabled>
                업그레이드 (준비 중)
              </Button>
              <p className="text-muted-foreground mt-2 text-xs">
                결제는 준비 중이에요. 지금은 검색 횟수가 제한되지 않아요.
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="AI 사용"
        icon={<Sparkles className="size-4" />}
        action={
          loading ? null : usage.ready ? (
            <StatusBadge tone="emerald">
              <CheckCircle2 className="size-3" />
              사용 가능
            </StatusBadge>
          ) : (
            <StatusBadge tone="amber">준비 중</StatusBadge>
          )
        }
      >
        {loading ? (
          <p className="text-muted-foreground text-sm">불러오는 중…</p>
        ) : !usage.ready ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            AI 기능(상품 분석·DM 작성)은 곧 사용할 수 있습니다. 관리자가 AI를 설정하면 자동으로
            켜집니다.
          </p>
        ) : (
          <div className="space-y-5">
            <p className="text-muted-foreground text-sm leading-relaxed">
              AI 분석·DM 작성은 Scout OS가 제공하며 별도 설정 없이 바로 사용할 수 있어요. 공정한
              사용을 위해 하루 사용량에 한도가 있습니다.
            </p>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-medium">오늘 사용량</span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {usage.used} / {usage.limit}회
                </span>
              </div>
              <div className="dark:bg-muted h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    pct >= 100 ? 'bg-destructive' : 'bg-primary',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs">
                {remaining > 0
                  ? `오늘 ${remaining}회 더 사용할 수 있어요. (매일 자정 초기화)`
                  : '오늘 한도를 모두 사용했어요. 내일 다시 사용할 수 있어요.'}
              </p>
            </div>

            {test.kind !== 'idle' ? (
              <p
                className={cn(
                  'text-sm',
                  test.kind === 'ok' ? 'text-emerald-600' : 'text-destructive',
                )}
              >
                {test.kind === 'ok' ? '✓ ' : '✗ '}
                {test.message}
              </p>
            ) : null}

            <Button variant="outline" size="sm" onClick={() => void runTest()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              AI 연결 테스트
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
