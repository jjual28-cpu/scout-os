'use client';

import { Bell, CalendarClock, MessageSquare, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useInbox } from '@/features/inbox/hooks/use-inbox';
import { useOutreach } from '@/features/search/hooks/use-outreach';

function username(id: string): string {
  return id.split(':')[1] ?? id;
}

/**
 * 헤더 알림 벨 — 오늘 처리할 일을 한곳에 모은다:
 *  - 후속 필요: 연락완료인데 예정일이 오늘/지난(아직 답변 없는) 셀럽
 *  - 받은 답장: 인박스 미읽음
 * 배지 수 = 둘의 합. 클릭하면 목록 드롭다운, 바깥 클릭으로 닫힘.
 */
export function NotificationBell() {
  const outreach = useOutreach();
  const { threads, unreadTotal } = useInbox();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().slice(0, 10);
  const due = Object.values(outreach.records)
    .filter((r) => r.status === '연락완료' && r.followUpAt && r.followUpAt <= today)
    .sort((a, b) => (a.followUpAt ?? '').localeCompare(b.followUpAt ?? ''));
  const unreadThreads = threads.filter((t) => t.unread > 0);
  const total = due.length + unreadTotal;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={total > 0 ? `알림 ${total}건` : '알림'}
        className="text-muted-foreground hover:text-foreground hover:bg-muted relative rounded-md p-2 transition-colors"
      >
        <Bell className="size-[18px]" />
        {total > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex min-w-[15px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {total > 99 ? '99+' : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="bg-popover text-popover-foreground absolute right-0 top-11 z-30 w-80 rounded-xl border p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-sm font-semibold">알림</p>
            {total > 0 ? <span className="text-muted-foreground text-xs">{total}건</span> : null}
          </div>

          {total === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">새 알림이 없어요.</p>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {due.length > 0 ? (
                <section>
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                      <CalendarClock className="size-3.5 text-amber-500" /> 후속 필요 {due.length}
                    </span>
                    <Link
                      href="/dm-queue?mode=followup"
                      onClick={() => setOpen(false)}
                      className="text-primary inline-flex items-center gap-0.5 text-xs hover:underline"
                    >
                      <RotateCcw className="size-3" /> 재연락
                    </Link>
                  </div>
                  <ul>
                    {due.slice(0, 4).map((r) => (
                      <li key={r.creatorId}>
                        <Link
                          href={`/creators/${encodeURIComponent(r.creatorId)}`}
                          onClick={() => setOpen(false)}
                          className="hover:bg-muted flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm"
                        >
                          <span className="truncate">@{username(r.creatorId)}</span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            예정 {r.followUpAt}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {unreadThreads.length > 0 ? (
                <section>
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                      <MessageSquare className="size-3.5 text-rose-500" /> 받은 답장 {unreadTotal}
                    </span>
                    <Link
                      href="/inbox"
                      onClick={() => setOpen(false)}
                      className="text-primary text-xs hover:underline"
                    >
                      전체
                    </Link>
                  </div>
                  <ul>
                    {unreadThreads.slice(0, 4).map((t) => (
                      <li key={t.peerId}>
                        <Link
                          href="/inbox"
                          onClick={() => setOpen(false)}
                          className="hover:bg-muted flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm"
                        >
                          <span className="truncate">
                            {t.peerUsername ? `@${t.peerUsername}` : `셀럽 ${t.peerId.slice(-6)}`}
                          </span>
                          <span className="shrink-0 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                            {t.unread}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
