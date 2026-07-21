'use client';

import { CalendarClock, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import Link from 'next/link';

import { EmptyState, StatusBadge } from '@/components/layout/blocks';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { toStage } from '../crm-stages';
import { generateDmDraft } from '../dm';
import { generateAiDm, generateStyledDm } from '../dm-generate';
import { useDmDrafts } from '../hooks/use-dm-drafts';
import { useDmTemplate } from '../hooks/use-dm-template';
import { useOutreach } from '../hooks/use-outreach';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';
import { OutreachCard } from './outreach-card';

function username(id: string): string {
  return id.split(':')[1] ?? id;
}

function SectionLabel({
  icon,
  count,
  children,
}: {
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="dark:text-muted-foreground text-slate-400">{icon}</span>
      <h2 className="dark:text-muted-foreground text-xs font-semibold uppercase tracking-wide text-slate-400">
        {children}
      </h2>
      <span className="dark:bg-muted dark:text-muted-foreground rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
        {count}
      </span>
    </div>
  );
}

function QueueRow({
  creatorId,
  meta,
  badge,
  tone,
}: {
  creatorId: string;
  meta: string;
  badge: string;
  tone: 'indigo' | 'amber' | 'emerald' | 'fuchsia';
}) {
  return (
    <li>
      <Link
        href={`/creators/${encodeURIComponent(creatorId)}`}
        className="dark:hover:bg-muted/40 flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">@{username(creatorId)}</p>
          {meta ? (
            <p className="dark:text-muted-foreground truncate text-xs text-slate-500">{meta}</p>
          ) : null}
        </div>
        <StatusBadge tone={tone}>{badge}</StatusBadge>
      </Link>
    </li>
  );
}

function QueueSection({
  icon,
  title,
  count,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionLabel icon={icon} count={count}>
        {title}
      </SectionLabel>
      {count === 0 ? (
        <p className="dark:border-border dark:text-muted-foreground rounded-xl border border-slate-200/60 py-8 text-center text-sm text-slate-400">
          {empty}
        </p>
      ) : (
        <div className="dark:border-border overflow-hidden rounded-xl border border-slate-200/60">
          <ul className="dark:divide-border/60 divide-y divide-slate-100">{children}</ul>
        </div>
      )}
    </section>
  );
}

/** Outreach as a work queue: 오늘 처리할 일 → 답변 대기 → 후속 예정 → 완료된 연락. */
export function OutreachList() {
  const { saved, hydrated } = useSavedOpportunities();
  const { getDraft, setDraft } = useDmDrafts();
  const { template: dmTemplate } = useDmTemplate();
  const outreach = useOutreach();

  /** kind='ai' AI가 통째로 / 'style' 저장한 내 DM 스타일. */
  const generate = async (item: (typeof saved)[number], kind: 'ai' | 'style') => {
    const fallback = generateDmDraft(item);
    const creator = {
      displayName: item.name,
      username: item.handle ?? username(item.id),
      biography: item.reason ?? null,
      category: item.type ?? null,
      followersCount: item.followersCount ?? null,
    };
    const { text } =
      kind === 'style'
        ? await generateStyledDm({ template: dmTemplate, creator, fallback })
        : await generateAiDm({ creator, fallback });
    setDraft(item.id, text);
  };

  const todo = saved.filter((s) => s.status === '연락예정');
  const followUps = outreach.followUpsDueToday();
  const records = Object.values(outreach.records);
  const waiting = records.filter((r) => toStage(r.status) === '연락 완료');
  const done = records.filter((r) => {
    const s = toStage(r.status);
    return s === '답변' || s === '협업';
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader title="Outreach" description="오늘 처리할 연락을 업무 큐로 관리하세요." />

      {!hydrated ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-40 rounded" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-10">
          {/* 오늘 처리할 일 — DM 준비 */}
          <section>
            <SectionLabel icon={<Send className="size-4" />} count={todo.length}>
              오늘 처리할 일 · DM 준비
            </SectionLabel>
            {todo.length === 0 ? (
              <EmptyState
                icon={<Send className="size-5" />}
                title="DM을 준비할 대상이 없어요"
                description="저장한 셀럽의 상태를 ‘연락예정’으로 바꾸면 여기에 모입니다."
                action={
                  <Button asChild size="sm">
                    <Link href="/saved">저장한 셀럽으로</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {todo.map((item) => (
                  <OutreachCard
                    key={item.id}
                    item={item}
                    draft={getDraft(item.id)}
                    hasTemplate={dmTemplate.trim().length > 0}
                    onGenerate={(kind) => generate(item, kind)}
                  />
                ))}
              </div>
            )}
          </section>

          <QueueSection
            icon={<MessageSquare className="size-4" />}
            title="답변 대기"
            count={waiting.length}
            empty="답변을 기다리는 연락이 없어요."
          >
            {waiting.map((r) => (
              <QueueRow
                key={r.creatorId}
                creatorId={r.creatorId}
                meta={
                  r.contactedAt ? `연락 ${r.contactedAt.slice(0, 10)} · ${r.contactCount}회` : ''
                }
                badge="연락 완료"
                tone="indigo"
              />
            ))}
          </QueueSection>

          <QueueSection
            icon={<CalendarClock className="size-4" />}
            title="후속 예정"
            count={followUps.length}
            empty="예정된 후속 연락이 없어요."
          >
            {followUps.map((r) => (
              <QueueRow
                key={r.creatorId}
                creatorId={r.creatorId}
                meta={`예정일 ${r.followUpAt} · ${r.contactCount}회`}
                badge="후속"
                tone="amber"
              />
            ))}
          </QueueSection>

          <QueueSection
            icon={<CheckCircle2 className="size-4" />}
            title="완료된 연락"
            count={done.length}
            empty="아직 답변·협업으로 이어진 연락이 없어요."
          >
            {done.map((r) => {
              const s = toStage(r.status);
              return (
                <QueueRow
                  key={r.creatorId}
                  creatorId={r.creatorId}
                  meta={
                    r.replyNote
                      ? r.replyNote.slice(0, 44)
                      : s === '협업'
                        ? '협업 진행'
                        : '답변 도착'
                  }
                  badge={s}
                  tone={s === '협업' ? 'emerald' : 'fuchsia'}
                />
              );
            })}
          </QueueSection>
        </div>
      )}
    </div>
  );
}
