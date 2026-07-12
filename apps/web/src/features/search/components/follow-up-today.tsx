'use client';

import { CalendarClock } from 'lucide-react';
import Link from 'next/link';

import { CONTACT_STATUS_META } from '../status';
import { useOutreach } from '../hooks/use-outreach';
import { type ContactStatus } from '../types';

/** Creators whose follow-up date is today or overdue. Hidden when there are none. */
export function FollowUpToday() {
  const { followUpsDueToday, hydrated } = useOutreach();
  const due = followUpsDueToday();
  if (!hydrated || due.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 pt-10">
      <section className="border-primary/20 bg-primary/5 rounded-2xl border p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock className="size-4" />
          오늘 후속 연락할 대상
          <span className="bg-primary/10 text-primary ml-1 rounded-full px-1.5 text-xs font-medium">
            {due.length}
          </span>
        </h2>
        <ul className="mt-3 divide-y">
          {due.map((r) => {
            const username = r.creatorId.split(':')[1] ?? r.creatorId;
            const meta = CONTACT_STATUS_META[r.status as ContactStatus];
            return (
              <li
                key={r.creatorId}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <Link
                  href={`/creators/${encodeURIComponent(r.creatorId)}`}
                  className="hover:text-primary min-w-0 truncate font-medium"
                >
                  @{username}
                </Link>
                <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
                  <span>예정일 {r.followUpAt}</span>
                  <span>· {r.contactCount}회</span>
                  {meta ? (
                    <span className={`rounded-full px-2 py-0.5 ${meta.active}`}>{r.status}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
