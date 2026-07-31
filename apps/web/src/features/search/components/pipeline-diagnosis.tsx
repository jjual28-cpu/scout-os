'use client';

import { ArrowRight, MessageSquareText, Package, Send, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { useCampaigns } from '@/features/campaigns/hooks/use-campaigns';
import { useProducts } from '@/features/products/hooks/use-products';
import { cn } from '@/lib/utils';

import { useOutreach } from '../hooks/use-outreach';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';

type Insight = {
  key: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
  icon: typeof Send;
  tone: 'primary' | 'amber' | 'blue';
};

const TONE: Record<Insight['tone'], string> = {
  primary: 'bg-primary/10 text-primary',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
};

/**
 * 파이프라인 진단 — 저장·연락·답변 데이터를 읽어 "지금 개선하면 좋을 것"을 콕 집어
 * 준다. '오늘 처리할 일' 배너(후속·답변 대기)와 겹치지 않게, 여기선 과정·품질 병목만
 * 다룬다: 저장→DM 갭 · 낮은 답변율 · 상품 미등록. 짚을 게 없으면 렌더하지 않는다.
 */
export function PipelineDiagnosis() {
  const { saved, hydrated: savedHydrated } = useSavedOpportunities();
  const outreach = useOutreach();
  const { campaigns, hydrated: campaignsHydrated } = useCampaigns();
  const { products } = useProducts();

  const insights = useMemo<Insight[]>(() => {
    const recs = outreach.records;
    const contacted = Object.values(recs).filter((r) => r.contactedAt).length;
    const replied = Object.values(recs).filter(
      (r) => r.status === '답변옴' || r.replyStatus === '답변옴',
    ).length;
    // 저장했지만 아직 연락 안 함(제외 제외).
    const savedNotDmd = saved.filter((s) => {
      const r = recs[s.id];
      return r?.status !== '제외' && !r?.contactedAt;
    }).length;
    const hasActivity = campaigns.length > 0 || saved.length > 0;
    const replyRate = contacted > 0 ? replied / contacted : null;

    const list: Insight[] = [];
    if (savedNotDmd >= 3) {
      list.push({
        key: 'saved-not-dmd',
        title: `저장만 하고 DM 안 보낸 셀럽 ${savedNotDmd}명`,
        desc: '발송 큐에서 한 명씩 넘기며 빠르게 보낼 수 있어요.',
        cta: 'DM 보내기',
        href: '/dm-queue',
        icon: Send,
        tone: 'primary',
      });
    }
    if (contacted >= 5 && replyRate !== null && replyRate < 0.15) {
      list.push({
        key: 'low-reply',
        title: `답변율이 ${Math.round(replyRate * 100)}%로 낮아요`,
        desc: 'DM 첫 문장·제안을 다듬으면 응답률이 올라가요.',
        cta: 'DM 스타일 손보기',
        href: '/settings#dm-style',
        icon: MessageSquareText,
        tone: 'amber',
      });
    }
    if (products.length === 0 && hasActivity) {
      list.push({
        key: 'no-product',
        title: '상품을 등록해 보세요',
        desc: 'AI가 상품에 맞는 셀럽·키워드를 더 정확히 추천해요.',
        cta: '상품 등록',
        href: '/products',
        icon: Package,
        tone: 'blue',
      });
    }
    return list.slice(0, 3);
  }, [saved, outreach.records, campaigns.length, products.length]);

  const hydrated = savedHydrated && campaignsHydrated && outreach.hydrated;
  if (!hydrated || insights.length === 0) return null;

  return (
    <section className="dark:border-border mb-8 rounded-2xl border border-slate-200/60 p-5">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Stethoscope className="text-primary size-4" />
        파이프라인 진단
      </h2>
      <ul className="space-y-1.5">
        {insights.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.key}>
              <Link
                href={it.href}
                className="dark:border-border dark:hover:border-border bg-background flex items-center gap-3 rounded-xl border border-slate-200/60 px-3 py-2.5 transition-colors hover:border-slate-300"
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    TONE[it.tone],
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.title}</p>
                  <p className="text-muted-foreground truncate text-xs">{it.desc}</p>
                </div>
                <span className="text-primary inline-flex shrink-0 items-center gap-0.5 text-xs font-medium">
                  {it.cta} <ArrowRight className="size-3.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
