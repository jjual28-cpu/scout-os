'use client';

import {
  BarChart3,
  Filter,
  Info,
  MessageSquare,
  Package,
  Percent,
  Reply,
  Search,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
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

/**
 * 발굴 퍼널 — 발견→저장→DM→답변→협업의 단계별 규모와 이전 단계 대비 전환율을
 * 가로 막대로 보여준다. 막대 폭은 첫 단계(발견) 기준 상대 비율. 어디서 이탈하는지
 * 한눈에 드러나게 한다.
 */
function FunnelChart({ stages }: { stages: { label: string; value: number; bar: string }[] }) {
  const top = stages[0]?.value ?? 0;
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const widthPct = top > 0 ? Math.max((s.value / top) * 100, s.value > 0 ? 3 : 0) : 0;
        const prev = i > 0 ? stages[i - 1]!.value : null;
        const stepConv = prev != null && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground tabular-nums">
                <span className="text-foreground font-semibold">{s.value}</span>
                {stepConv != null ? (
                  <span className="ml-2 text-xs">이전 대비 {stepConv}%</span>
                ) : null}
              </span>
            </div>
            <div className="dark:bg-muted h-6 w-full overflow-hidden rounded-lg bg-slate-100">
              <div
                className={cn('h-full rounded-lg transition-all', s.bar)}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 활동 추이 — 버킷별 캠페인 생성·DM 발송 건수를 세로 이중 막대로. 발생 시각이 확실한
 * 두 이벤트만 그린다(답변/협업 제외). 막대 높이는 전체 최댓값 기준 상대값.
 */
function TrendChart({ data }: { data: { label: string; campaigns: number; dm: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.campaigns, d.dm)));
  const h = (v: number) => (v > 0 ? Math.max((v / max) * 100, 5) : 0);
  const hasAny = data.some((d) => d.campaigns > 0 || d.dm > 0);
  return (
    <div>
      <div className="flex items-end gap-1.5 sm:gap-2.5" style={{ height: 152 }}>
        {data.map((d, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-end justify-center gap-1" style={{ height: 128 }}>
              <div
                className="bg-primary w-2 rounded-t transition-all sm:w-2.5"
                style={{ height: `${h(d.campaigns)}%` }}
                title={`캠페인 ${d.campaigns}`}
              />
              <div
                className="w-2 rounded-t bg-fuchsia-500 transition-all sm:w-2.5"
                style={{ height: `${h(d.dm)}%` }}
                title={`DM ${d.dm}`}
              />
            </div>
            <span className="text-muted-foreground truncate text-[10px] tabular-nums">
              {d.label}
            </span>
          </div>
        ))}
      </div>
      <div className="text-muted-foreground mt-3 flex items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary size-2.5 rounded-sm" />
          캠페인 생성
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-fuchsia-500" />
          DM 발송
        </span>
        {!hasAny ? <span className="ml-auto">이 기간엔 활동이 없어요.</span> : null}
      </div>
    </div>
  );
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
              accent="primary"
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
              accent="blue"
              delta={
                <span className="text-muted-foreground">
                  고유 <Num>{kpis.uniqueCreators}</Num>명
                </span>
              }
            />
            <StatCard
              icon={<Star className="size-4" />}
              label="저장"
              value={kpis.saved}
              accent="amber"
            />
            <StatCard
              icon={<MessageSquare className="size-4" />}
              label="DM"
              value={kpis.dm}
              accent="fuchsia"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={<Reply className="size-4" />}
              label="답변"
              value={kpis.reply}
              accent="emerald"
            />
            <StatCard
              icon={<Star className="size-4" />}
              label="협업"
              value={kpis.collab}
              accent="rose"
            />
            <StatCard
              icon={<Percent className="size-4" />}
              label="응답률"
              value={`${kpis.dm > 0 ? Math.round((kpis.reply / kpis.dm) * 100) : 0}%`}
              accent="emerald"
              delta={<span className="text-muted-foreground">답변 ÷ DM</span>}
            />
            <StatCard
              icon={<BarChart3 className="size-4" />}
              label="전환율"
              value={`${kpis.conversion}%`}
              accent="primary"
              delta={<span className="text-muted-foreground">협업 ÷ DM</span>}
            />
          </div>

          {/* 발굴 퍼널 — 단계별 이탈을 한눈에 */}
          <SectionCard title="발굴 퍼널" icon={<Filter className="size-4" />} bodyClassName="mt-4">
            <FunnelChart
              stages={[
                { label: '발견', value: kpis.discovered, bar: 'bg-blue-500' },
                { label: '저장', value: kpis.saved, bar: 'bg-amber-500' },
                { label: 'DM 발송', value: kpis.dm, bar: 'bg-fuchsia-500' },
                { label: '답변', value: kpis.reply, bar: 'bg-emerald-500' },
                { label: '협업', value: kpis.collab, bar: 'bg-rose-500' },
              ]}
            />
            <p className="text-muted-foreground mt-3 text-xs">
              막대 폭은 발견 대비 비율 · ‘이전 대비’는 직전 단계 대비 전환율입니다.
            </p>
          </SectionCard>

          {/* 활동 추이 — 실제 이벤트 시각 기준(캠페인 생성·DM 발송) */}
          <SectionCard
            title="활동 추이"
            icon={<TrendingUp className="size-4" />}
            bodyClassName="mt-4"
          >
            <TrendChart data={data.trend} />
            <p className="text-muted-foreground mt-3 text-xs">
              실제 발생 시각 기준 — 캠페인 생성일·DM 발송일({range === '7d' ? '일' : '주'} 단위).
              답변·협업은 발생 시각 데이터가 없어 추이에는 넣지 않아요.
            </p>
          </SectionCard>

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
