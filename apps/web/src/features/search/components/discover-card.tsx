'use client';

import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Instagram,
  MessageSquarePlus,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { creatorBadge } from '../creator-status';
import { type DiscoverOpportunity } from '../discover-mock';
import { useOutreach } from '../hooks/use-outreach';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';
import { keywordEmoji } from '../keyword';
import { OpportunityBody } from './opportunity-body';

export function DiscoverCard({
  item,
  keyword,
  selectable,
  selected,
  onSelectChange,
}: {
  item: DiscoverOpportunity;
  keyword?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (id: string, next: boolean) => void;
}) {
  const { isSaved, toggle } = useSavedOpportunities();
  const outreach = useOutreach();
  const router = useRouter();
  const saved = isSaved(item.id);

  // Real creators carry a profileUrl → the detail/outreach flow applies to them.
  const isReal = Boolean(item.profileUrl);
  const detailHref = `/creators/${encodeURIComponent(item.id)}`;

  const rec = outreach.records[item.id];
  const badge = creatorBadge(rec?.status, Boolean(rec?.dmDraft?.trim()));

  const prepareContact = () => {
    if (!saved) toggle(item);
    outreach.setStatus(item.id, '연락예정');
    router.push(detailHref);
  };

  return (
    <article
      className={cn(
        'bg-card group relative flex flex-col overflow-hidden rounded-2xl border p-5',
        'transition-all duration-200 ease-out',
        'hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/[0.04]',
        selected && 'ring-primary/50 border-primary/40 ring-2',
      )}
    >
      <div
        aria-hidden
        className="via-primary/50 pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      {selectable && isReal ? (
        <label className="absolute right-3 top-3 z-[1] flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={Boolean(selected)}
            onChange={(e) => onSelectChange?.(item.id, e.target.checked)}
            className="accent-primary size-4 cursor-pointer rounded"
            aria-label={`${item.name} 선택`}
          />
        </label>
      ) : null}

      {keyword || badge ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {keyword ? (
            <span className="bg-primary/10 text-primary inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium">
              {keywordEmoji(keyword)} {keyword}
            </span>
          ) : null}
          {badge ? <span className={badge.className}>{badge.label}</span> : null}
        </div>
      ) : null}

      <OpportunityBody result={item} />

      {/* 발견일 + 실제 프로필 링크 */}
      <div className="text-muted-foreground mt-4 flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          발견일 · {item.discoveredAt}
        </span>
        {item.profileUrl ? (
          <a
            href={item.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
          >
            <Instagram className="size-3.5" />
            프로필 열기
          </a>
        ) : null}
      </div>

      {/* 저장 */}
      <Button
        type="button"
        variant={saved ? 'secondary' : 'outline'}
        className="mt-4 w-full"
        aria-pressed={saved}
        onClick={() => toggle(item)}
      >
        {saved ? (
          <>
            <BookmarkCheck className="size-4" />
            저장됨
          </>
        ) : (
          <>
            <Bookmark className="size-4" />
            저장
          </>
        )}
      </Button>

      {/* DM / 자세히 보기 / 연락 준비 — 실제 크리에이터에만 */}
      {isReal ? (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button asChild type="button" variant="ghost" size="sm">
            <Link href={detailHref}>
              <Send className="size-4" />
              DM
            </Link>
          </Button>
          <Button asChild type="button" variant="ghost" size="sm">
            <Link href={detailHref}>자세히</Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={prepareContact}>
            <MessageSquarePlus className="size-4" />
            연락
          </Button>
        </div>
      ) : null}
    </article>
  );
}
