'use client';

import {
  ArrowRight,
  Bookmark,
  CalendarClock,
  Reply,
  Search,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useOutreach } from '../hooks/use-outreach';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';
import { useSearches } from '../hooks/use-searches';

const DAY = 86_400_000;

function creatorUsername(creatorId: string): string {
  return creatorId.split(':')[1] ?? creatorId;
}

export function DashboardHome() {
  const { saved } = useSavedOpportunities();
  const outreach = useOutreach();
  const { rows: searches } = useSearches();

  const now = Date.now();
  const weekAgo = now - 7 * DAY;

  const records = useMemo(() => Object.values(outreach.records), [outreach.records]);
  const followUps = outreach.followUpsDueToday();
  const replies = records.filter((r) => r.status === '답변옴');
  const toReview = useMemo(
    () =>
      saved
        .filter((s) => s.status === '미검토')
        .sort((a, b) => b.savedAt - a.savedAt)
        .slice(0, 6),
    [saved],
  );

  // Weekly activity (last 7 days)
  const weekly = useMemo(() => {
    const searchCount = searches.filter((s) => new Date(s.createdAt).getTime() >= weekAgo).length;
    const savedCount = saved.filter((s) => s.savedAt >= weekAgo).length;
    const contacted = records.filter(
      (r) => r.contactedAt && new Date(r.contactedAt).getTime() >= weekAgo,
    ).length;
    return { searchCount, savedCount, contacted, replies: replies.length };
  }, [searches, saved, records, replies.length, weekAgo]);

  // Top keywords
  const topKeywords = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of searches) counts.set(s.query, (counts.get(s.query) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [searches]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">오늘의 업무</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            발굴부터 협업까지 — 오늘 처리할 일을 한눈에.
          </p>
        </div>
        <Button asChild>
          <Link href="/discover">
            <Search className="size-4" />새 검색
          </Link>
        </Button>
      </div>

      {/* Weekly activity */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={<Search className="size-4" />}
          label="이번 주 검색"
          value={weekly.searchCount}
        />
        <StatTile
          icon={<Bookmark className="size-4" />}
          label="이번 주 저장"
          value={weekly.savedCount}
        />
        <StatTile
          icon={<Send className="size-4" />}
          label="이번 주 연락"
          value={weekly.contacted}
        />
        <StatTile icon={<Reply className="size-4" />} label="답변 받음" value={weekly.replies} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Today's follow-up */}
        <Panel
          icon={<CalendarClock className="size-4" />}
          title="오늘 후속 연락"
          count={followUps.length}
          empty="오늘 후속 연락할 대상이 없어요."
        >
          {followUps.map((r) => (
            <Row
              key={r.creatorId}
              href={`/creators/${encodeURIComponent(r.creatorId)}`}
              title={`@${creatorUsername(r.creatorId)}`}
              meta={`예정일 ${r.followUpAt} · ${r.contactCount}회`}
              badge={r.status}
            />
          ))}
        </Panel>

        {/* Recent replies */}
        <Panel
          icon={<Reply className="size-4" />}
          title="최근 답변"
          count={replies.length}
          empty="아직 받은 답변이 없어요."
        >
          {replies.slice(0, 6).map((r) => (
            <Row
              key={r.creatorId}
              href={`/creators/${encodeURIComponent(r.creatorId)}`}
              title={`@${creatorUsername(r.creatorId)}`}
              meta={r.replyNote ? r.replyNote.slice(0, 40) : '답변 도착'}
              badge="답변옴"
            />
          ))}
        </Panel>

        {/* Saved to review */}
        <Panel
          icon={<Bookmark className="size-4" />}
          title="검토할 저장"
          count={toReview.length}
          empty="검토할 저장이 없어요."
          action={{ href: '/saved', label: '전체 보기' }}
        >
          {toReview.map((s) => (
            <Row
              key={s.id}
              href={`/creators/${encodeURIComponent(s.id)}`}
              title={s.name}
              meta={s.handle ? `@${s.handle}` : s.type}
              badge={s.status}
            />
          ))}
        </Panel>

        {/* Top keywords */}
        <section className="bg-card rounded-2xl border p-5">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="text-primary size-4" />
            <h2 className="text-sm font-semibold">Top 키워드</h2>
          </div>
          {topKeywords.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">
              검색 기록이 쌓이면 자주 찾는 키워드가 여기 표시돼요.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {topKeywords.map(([kw, n]) => (
                <Link
                  key={kw}
                  href="/discover"
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/70 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors"
                >
                  {kw}
                  <span className="text-muted-foreground text-xs">{n}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Empty-overall hint */}
      {saved.length === 0 && records.length === 0 && searches.length === 0 ? (
        <div className="border-primary/20 bg-primary/[0.04] mt-6 flex items-center gap-3 rounded-2xl border p-5">
          <Sparkles className="text-primary size-5 shrink-0" />
          <p className="text-sm">
            아직 데이터가 없어요.{' '}
            <Link
              href="/discover"
              className="text-primary font-medium underline-offset-2 hover:underline"
            >
              첫 검색
            </Link>
            으로 크리에이터를 발굴해 보세요.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card rounded-2xl border p-4">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Panel({
  icon,
  title,
  count,
  empty,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  empty: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-2xl border p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-primary">{icon}</span>
          <h2 className="text-sm font-semibold">{title}</h2>
          {count > 0 ? (
            <span className="bg-primary/10 text-primary ml-1 rounded-full px-1.5 text-xs font-medium">
              {count}
            </span>
          ) : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-xs"
          >
            {action.label}
            <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </div>
      {count === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y">{children}</ul>
      )}
    </section>
  );
}

function Row({
  href,
  title,
  meta,
  badge,
}: {
  href: string;
  title: string;
  meta: string;
  badge?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-muted-foreground truncate text-xs">{meta}</p>
        </div>
        {badge ? (
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-xs',
              'text-muted-foreground',
            )}
          >
            {badge}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
