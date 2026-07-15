'use client';

import { BarChart3, Info, MessageSquare, Package, Reply, Search, Star, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState, SectionCard, StatCard } from '@/components/layout/blocks';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useReports } from '../hooks/use-reports';
import {
  DEFAULT_RANGE,
  parseRange,
  RANGE_KEYS,
  RANGE_LABEL,
  reportsHref,
  type RangeKey,
} from '../range';

function RangeTabs({ value, onChange }: { value: RangeKey; onChange: (r: RangeKey) => void }) {
  return (
    <div
      role="tablist"
      aria-label="기간 선택"
      className="dark:border-border dark:bg-muted/30 inline-flex rounded-lg border border-slate-200/60 p-0.5"
    >
      {RANGE_KEYS.map((k) => (
        <button
          key={k}
          role="tab"
          type="button"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === k
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {RANGE_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="tabular-nums">{children}</span>;
}

export function ReportsPage() {
  const router = useRouter();

  // Read from location (not useSearchParams) to avoid forcing a Suspense boundary.
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  useEffect(() => {
    setRange(parseRange(window.location.search));
  }, []);

  // Pinned at mount: the cohort boundary must not drift while the user reads.
  const now = useMemo(() => new Date(), []);
  const data = useReports(range, now);

  const changeRange = (r: RangeKey) => {
    setRange(r);
    router.replace(reportsHref(r), { scroll: false });
  };

  const { kpis, cohort } = data;
  const sc = kpis.statusCounts;
  const periodText = range === 'all' ? '전체 기간' : `최근 ${RANGE_LABEL[range]}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="성과 리포트"
        description="검색부터 저장, 연락, 답변, 협업까지 캠페인 성과를 확인하세요."
        actions={<RangeTabs value={range} onChange={changeRange} />}
      />

      {/* Cohort semantics — stated up front so no one reads these as a timeline. */}
      <div className="dark:border-border dark:bg-muted/20 mb-6 flex items-start gap-2.5 rounded-lg border border-slate-200/60 bg-slate-50/50 px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-400" />
        <p className="dark:text-muted-foreground text-xs leading-relaxed text-slate-500">
          <span className="dark:text-foreground font-medium text-slate-700">
            선택한 기간에 생성된 캠페인이 현재까지 만든 성과입니다.
          </span>{' '}
          답변·협업 수는 해당 기간에 발생한 건수가 아니라, {periodText}에 생성된 캠페인에서 현재까지
          발생한 누적 수입니다.
        </p>
      </div>

      {!data.hydrated ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : cohort.all.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title={`${periodText}에 만든 캠페인이 없어요`}
          description="기간을 넓히거나 새로 검색하면 성과가 집계됩니다."
        />
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={<Search className="size-4" />}
              label="검색 수"
              value={kpis.searches}
              delta={
                <span className="text-muted-foreground">
                  완료 <Num>{sc.succeeded}</Num>
                  {sc.running > 0 ? (
                    <>
                      {' · '}진행 중 <Num>{sc.running}</Num>
                    </>
                  ) : null}
                  {sc.failed > 0 ? (
                    <>
                      {' · '}실패 <Num>{sc.failed}</Num>
                    </>
                  ) : null}
                </span>
              }
            />
            <StatCard
              icon={<Users className="size-4" />}
              label="발견 셀럽"
              value={kpis.discovered}
              delta={
                <span className="text-muted-foreground">
                  고유 <Num>{kpis.uniqueCreators}</Num>명
                </span>
              }
            />
            <StatCard icon={<Star className="size-4" />} label="저장" value={kpis.saved} />
            <StatCard icon={<MessageSquare className="size-4" />} label="DM" value={kpis.dm} />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={<Reply className="size-4" />} label="답변" value={kpis.reply} />
            <StatCard icon={<Star className="size-4" />} label="협업" value={kpis.collab} />
            <StatCard
              icon={<BarChart3 className="size-4" />}
              label="전환율"
              value={`${kpis.conversion}%`}
              delta={<span className="text-muted-foreground">협업 ÷ DM</span>}
            />
          </div>

          {/* Top 검색어 / Top 캠페인 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Top 검색어" icon={<Search className="size-4" />}>
              {data.topQueries.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  완료된 검색이 없습니다.
                </p>
              ) : (
                <ul className="dark:divide-border/60 divide-y divide-slate-100">
                  {data.topQueries.map((q, i) => (
                    <li key={q.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="dark:text-muted-foreground w-4 shrink-0 text-xs tabular-nums text-slate-400">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{q.query}</span>
                      <span className="dark:text-muted-foreground shrink-0 text-xs tabular-nums text-slate-500">
                        {q.searches}회 · {q.discovered}명
                        {q.collab > 0 ? (
                          <span className="text-primary font-medium"> · 협업 {q.collab}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Top 캠페인" icon={<BarChart3 className="size-4" />}>
              {data.topCampaigns.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  완료된 캠페인이 없습니다.
                </p>
              ) : (
                <ul className="dark:divide-border/60 divide-y divide-slate-100">
                  {data.topCampaigns.map((c, i) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/campaigns/${c.id}`)}
                        className="dark:hover:bg-muted/40 flex w-full items-center gap-3 rounded-lg py-2.5 text-left transition-colors hover:bg-slate-50/70"
                      >
                        <span className="dark:text-muted-foreground w-4 shrink-0 text-xs tabular-nums text-slate-400">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.title}</span>
                          <span className="dark:text-muted-foreground block truncate text-xs text-slate-400">
                            {c.query}
                          </span>
                        </span>
                        <span className="dark:text-muted-foreground shrink-0 text-xs tabular-nums text-slate-500">
                          협업 {c.collab} · 답변 {c.reply} · DM {c.dm}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* 상품별 성과 */}
          <SectionCard
            title="상품별 성과"
            icon={<Package className="size-4" />}
            bodyClassName="mt-4"
          >
            {data.products.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                완료된 캠페인이 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="dark:border-border dark:text-muted-foreground border-b border-slate-200/60 text-left text-xs text-slate-400">
                      <th className="py-2.5 pr-4 font-medium">상품</th>
                      <th className="py-2.5 pr-4 text-right font-medium">캠페인</th>
                      <th className="py-2.5 pr-4 text-right font-medium">발견</th>
                      <th className="py-2.5 pr-4 text-right font-medium">저장</th>
                      <th className="py-2.5 pr-4 text-right font-medium">DM</th>
                      <th className="py-2.5 pr-4 text-right font-medium">답변</th>
                      <th className="py-2.5 pr-4 text-right font-medium">협업</th>
                      <th className="py-2.5 text-right font-medium">전환율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => (
                      <tr
                        key={p.productId ?? 'unassigned'}
                        className="dark:border-border/60 border-b border-slate-100 last:border-0"
                      >
                        <td className="max-w-[180px] py-3 pr-4">
                          <span
                            className={cn(
                              'block truncate',
                              p.productId
                                ? 'font-medium'
                                : 'dark:text-muted-foreground text-slate-400',
                            )}
                          >
                            {p.name}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">{p.campaigns}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">{p.discovered}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">{p.saved}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">{p.dm}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">{p.reply}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">{p.collab}</td>
                        <td className="py-3 text-right tabular-nums">
                          <span className={cn(p.conversion > 0 && 'text-primary font-medium')}>
                            {p.conversion}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Attribution caveat — outreach_activities is one row per creator, globally. */}
          <p className="dark:text-muted-foreground text-center text-xs text-slate-400">
            동일 셀럽이 여러 캠페인에 포함된 경우 일부 연락 성과가 중복 집계될 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
