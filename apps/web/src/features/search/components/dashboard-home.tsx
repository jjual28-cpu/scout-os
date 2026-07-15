'use client';

import {
  ArrowRight,
  ArrowUpRight,
  Megaphone,
  MessageSquare,
  Reply,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { EmptyState, StatCard } from '@/components/layout/blocks';
import { PageHeader } from '@/components/layout/page-header';
import { useCurrentUser } from '@/components/layout/use-current-user';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCampaigns } from '@/features/campaigns/hooks/use-campaigns';
import { LABEL_META } from '@/features/campaigns/label';
import { cn } from '@/lib/utils';

import { useOutreach } from '../hooks/use-outreach';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';

function creatorUsername(creatorId: string): string {
  return creatorId.split(':')[1] ?? creatorId;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="dark:text-muted-foreground text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </h2>
  );
}

export function DashboardHome() {
  const { saved } = useSavedOpportunities();
  const outreach = useOutreach();
  const { campaigns, hydrated } = useCampaigns();
  const { name } = useCurrentUser();

  const records = useMemo(() => Object.values(outreach.records), [outreach.records]);
  const followUps = outreach.followUpsDueToday();
  const replies = useMemo(() => records.filter((r) => r.status === '답변옴'), [records]);

  const kpis = useMemo(() => {
    const activeCampaigns = campaigns.filter((c) => c.label === 'active').length;
    const discovered = campaigns.reduce((a, c) => a + (c.summary?.discovered ?? 0), 0);
    const dmSent = records.filter((r) => r.contactedAt).length;
    return { activeCampaigns, discovered, dmSent, replies: replies.length };
  }, [campaigns, records, replies.length]);

  const recentCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [campaigns],
  );

  const recentCreators = useMemo(
    () => [...saved].sort((a, b) => b.savedAt - a.savedAt).slice(0, 6),
    [saved],
  );

  const activity = useMemo(() => {
    const items: { key: string; title: string; meta: string; href: string; kind: string }[] = [];
    for (const r of replies.slice(0, 4)) {
      items.push({
        key: `reply-${r.creatorId}`,
        kind: 'reply',
        title: `@${creatorUsername(r.creatorId)} 답변`,
        meta: r.replyNote ? r.replyNote.slice(0, 36) : '답변 도착',
        href: `/creators/${encodeURIComponent(r.creatorId)}`,
      });
    }
    for (const r of followUps.slice(0, 4)) {
      items.push({
        key: `fu-${r.creatorId}`,
        kind: 'followup',
        title: `@${creatorUsername(r.creatorId)} 후속 연락`,
        meta: `예정일 ${r.followUpAt} · ${r.contactCount}회`,
        href: `/creators/${encodeURIComponent(r.creatorId)}`,
      });
    }
    return items.slice(0, 6);
  }, [replies, followUps]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title={name ? `안녕하세요, ${name}님 👋` : '안녕하세요 👋'}
        description="오늘도 브랜드에 맞는 셀럽을 발견해보세요."
        actions={
          <Button asChild>
            <Link href="/discover">
              <Search className="size-4" />
              셀럽 검색하기
            </Link>
          </Button>
        }
      />

      {/* Today's Overview */}
      <SectionLabel>Today&apos;s Overview</SectionLabel>
      <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Megaphone className="size-4" />}
          label="진행 중 캠페인"
          value={kpis.activeCampaigns}
          href="/campaigns?status=running"
        />
        <StatCard
          icon={<Users className="size-4" />}
          label="발견한 셀럽"
          value={kpis.discovered}
          href="/campaigns"
        />
        <StatCard
          icon={<MessageSquare className="size-4" />}
          label="DM 발송"
          value={kpis.dmSent}
          href="/outreach"
        />
        <StatCard
          icon={<Reply className="size-4" />}
          label="답변 받음"
          value={kpis.replies}
          href="/crm"
        />
      </div>

      {/* Recent campaigns */}
      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>최근 캠페인</SectionLabel>
          {campaigns.length > 0 ? (
            <Link
              href="/campaigns"
              className="dark:text-muted-foreground dark:hover:text-foreground inline-flex items-center gap-0.5 text-xs text-slate-500 transition-colors hover:text-slate-900"
            >
              전체 보기 <ArrowRight className="size-3" />
            </Link>
          ) : null}
        </div>
        {!hydrated ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : recentCampaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="size-5" />}
            title="아직 캠페인이 없어요"
            description="셀럽을 검색하면 캠페인이 자동으로 만들어집니다."
            action={
              <Button asChild size="sm">
                <Link href="/discover">
                  <Search className="size-4" />
                  검색하러 가기
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="dark:border-border overflow-x-auto rounded-xl border border-slate-200/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="dark:border-border dark:text-muted-foreground border-b border-slate-200/60 text-left text-xs text-slate-400">
                  <th className="px-4 py-2.5 font-medium">캠페인</th>
                  <th className="px-4 py-2.5 text-right font-medium">셀럽</th>
                  <th className="hidden px-4 py-2.5 text-center font-medium sm:table-cell">상태</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
                    전환율
                  </th>
                  <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">
                    생성일
                  </th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {recentCampaigns.map((c) => {
                  const meta = LABEL_META[c.label];
                  return (
                    <tr
                      key={c.id}
                      className="dark:border-border/60 dark:hover:bg-muted/40 border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="max-w-[200px] px-4 py-3">
                        <Link href={`/campaigns/${c.id}`} className="block truncate font-medium">
                          {c.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.summary.discovered}</td>
                      <td className="hidden px-4 py-3 text-center sm:table-cell">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            meta.className,
                          )}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                        {c.summary.conversion}%
                      </td>
                      <td className="dark:text-muted-foreground hidden px-4 py-3 text-right text-slate-400 md:table-cell">
                        {fmtDate(c.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="hover:text-primary dark:text-muted-foreground inline-flex text-slate-300 transition-colors"
                          aria-label="캠페인 상세"
                        >
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recently discovered creators */}
      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>최근 발견한 셀럽</SectionLabel>
          {saved.length > 0 ? (
            <Link
              href="/saved"
              className="dark:text-muted-foreground dark:hover:text-foreground inline-flex items-center gap-0.5 text-xs text-slate-500 transition-colors hover:text-slate-900"
            >
              전체 보기 <ArrowRight className="size-3" />
            </Link>
          ) : null}
        </div>
        {recentCreators.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="아직 저장한 셀럽이 없어요"
            description="검색 결과에서 셀럽을 저장하면 여기에 모입니다."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentCreators.map((s) => (
              <Link
                key={s.id}
                href={`/creators/${encodeURIComponent(s.id)}`}
                className="dark:border-border dark:hover:border-border flex items-center gap-3 rounded-xl border border-slate-200/60 p-3 transition-all duration-150 hover:-translate-y-px hover:border-slate-300"
              >
                <span className="dark:bg-muted dark:text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
                  {(s.name || s.handle || '?').slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="dark:text-muted-foreground truncate text-xs text-slate-500">
                    {s.handle ? `@${s.handle}` : s.type}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* AI recommendation (coming soon) */}
      <div className="mt-10">
        <SectionLabel>AI 추천</SectionLabel>
        <div className="dark:border-border mt-3 flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200/60 p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3.5">
            <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
              <Sparkles className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">상품 기반 AI 셀럽 추천</p>
                <span className="dark:bg-muted dark:text-muted-foreground rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                  준비 중
                </span>
              </div>
              <p className="dark:text-muted-foreground mt-1 text-sm text-slate-500">
                상품을 등록하면 AI가 브랜드에 맞는 키워드와 셀럽을 자동으로 제안합니다.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/products">
              상품 등록하기 <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-10">
        <SectionLabel>최근 활동</SectionLabel>
        <div className="dark:border-border mt-3 rounded-xl border border-slate-200/60 p-2">
          {activity.length === 0 ? (
            <p className="dark:text-muted-foreground py-8 text-center text-sm text-slate-400">
              답변·후속 연락이 생기면 여기에 표시돼요.
            </p>
          ) : (
            <ul className="dark:divide-border/60 divide-y divide-slate-100">
              {activity.map((a) => (
                <li key={a.key}>
                  <Link
                    href={a.href}
                    className="dark:hover:bg-muted/40 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50/70"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="dark:text-muted-foreground truncate text-xs text-slate-500">
                        {a.meta}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        a.kind === 'reply'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-amber-500/15 text-amber-600',
                      )}
                    >
                      {a.kind === 'reply' ? '답변' : '후속'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
