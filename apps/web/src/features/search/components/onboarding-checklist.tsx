'use client';

import { ArrowRight, Bookmark, Check, Compass, Package, Send } from 'lucide-react';
import Link from 'next/link';

import { useCampaigns } from '@/features/campaigns/hooks/use-campaigns';
import { useProducts } from '@/features/products/hooks/use-products';
import { cn } from '@/lib/utils';

import { useOutreach } from '../hooks/use-outreach';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';

/**
 * 신규 사용자 활성화(activation) 체크리스트 — 검색→저장→DM 핵심 루프를 안내해
 * "성공 경험"까지 데려간다. 활성화가 전환(유료)로 이어지므로 온보딩의 핵심 UI.
 *
 * 핵심 3단계(검색·저장·DM)를 모두 마치면 자동으로 사라져 활성 사용자를 방해하지
 * 않는다(상품 등록은 선택 단계라 노출 여부를 결정하지 않는다).
 */
export function OnboardingChecklist() {
  const { saved, hydrated: savedHydrated } = useSavedOpportunities();
  const outreach = useOutreach();
  const { campaigns, hydrated: campaignsHydrated } = useCampaigns();
  const { products } = useProducts();

  const searchDone = campaigns.length > 0;
  const saveDone = saved.length > 0;
  const dmDone = Object.values(outreach.records).some((r) => r.contactedAt);
  const productDone = products.length > 0;

  const hydrated = savedHydrated && campaignsHydrated && outreach.hydrated;
  const coreDone = searchDone && saveDone && dmDone;
  if (!hydrated || coreDone) return null;

  const steps = [
    {
      key: 'search',
      label: '셀럽 검색해보기',
      desc: '키워드로 브랜드에 맞는 셀럽 찾기',
      done: searchDone,
      href: '/discover',
      cta: '검색하기',
      icon: Compass,
    },
    {
      key: 'save',
      label: '마음에 드는 셀럽 저장',
      desc: '검색 결과에서 저장하면 CRM에 쌓여요',
      done: saveDone,
      href: '/discover',
      cta: '저장하러',
      icon: Bookmark,
    },
    {
      key: 'dm',
      label: '첫 DM 보내기',
      desc: '저장한 셀럽에게 협업 제안 DM',
      done: dmDone,
      href: '/dm-queue',
      cta: 'DM 보내기',
      icon: Send,
    },
    {
      key: 'product',
      label: '상품 등록 (선택)',
      desc: '등록하면 AI가 더 잘 맞는 셀럽을 추천해요',
      done: productDone,
      href: '/products',
      cta: '등록하기',
      icon: Package,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const next = steps.find((s) => !s.done);

  return (
    <section className="border-primary/25 from-primary/[0.07] mb-8 rounded-2xl border bg-gradient-to-br to-fuchsia-500/[0.05] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Scout OS 시작하기 👋</h2>
          <p className="text-muted-foreground text-sm">
            첫 셀럽을 발굴하고 협업 제안까지 — 몇 분이면 돼요.
          </p>
        </div>
        <span className="text-primary shrink-0 text-sm font-semibold tabular-nums">
          {doneCount}/{steps.length}
        </span>
      </div>

      <div className="bg-primary/10 mb-4 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {steps.map((s) => {
          const Icon = s.icon;
          const isNext = next?.key === s.key;
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                  s.done
                    ? 'dark:border-border border-slate-200/60 opacity-60'
                    : isNext
                      ? 'border-primary/40 bg-background hover:border-primary'
                      : 'dark:border-border bg-background border-slate-200/60 hover:border-slate-300',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full',
                    s.done ? 'bg-emerald-500 text-white' : 'bg-primary/10 text-primary',
                  )}
                >
                  {s.done ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-medium', s.done && 'line-through')}>{s.label}</p>
                  <p className="text-muted-foreground truncate text-xs">{s.desc}</p>
                </div>
                {!s.done ? (
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-0.5 text-xs font-medium',
                      isNext ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {s.cta} <ArrowRight className="size-3.5" />
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
