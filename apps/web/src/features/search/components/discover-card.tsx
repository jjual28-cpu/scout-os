'use client';

import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Instagram,
  MessageSquarePlus,
  MoreHorizontal,
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
  const contactLine = rec?.contactedAt
    ? `최근 연락 ${rec.contactedAt.slice(0, 10)}`
    : rec?.followUpAt
      ? `후속 예정 ${rec.followUpAt}`
      : null;

  const prepareContact = () => {
    if (!saved) toggle(item);
    outreach.setStatus(item.id, '연락예정');
    router.push(detailHref);
  };

  return (
    <article
      className={cn(
        'bg-card dark:border-border group relative flex flex-col rounded-2xl border border-slate-200/60 p-5',
        'dark:hover:border-border transition-all duration-150 ease-out hover:-translate-y-px hover:border-slate-300',
        selected && 'ring-primary/50 border-primary/40 ring-2',
      )}
    >
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
            <span className="dark:bg-muted dark:text-muted-foreground inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {keywordEmoji(keyword)} {keyword}
            </span>
          ) : null}
          {badge ? <span className={badge.className}>{badge.label}</span> : null}
        </div>
      ) : null}

      <OpportunityBody result={item} />

      {/* 발견일 + 최근 연락 상태 */}
      <div className="text-muted-foreground mt-4 flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          발견일 · {item.discoveredAt}
        </span>
        {contactLine ? <span className="truncate">{contactLine}</span> : null}
      </div>

      {/* Actions: Primary (저장) + Secondary (DM/상세) + More menu */}
      <div className="mt-4">
        <Button
          type="button"
          variant={saved ? 'secondary' : 'default'}
          className="w-full"
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

        {isReal ? (
          <div className="mt-2 flex items-center gap-2">
            <Button asChild type="button" variant="outline" size="sm" className="flex-1">
              <Link href={detailHref}>
                <Send className="size-4" />
                DM
              </Link>
            </Button>
            <Button asChild type="button" variant="outline" size="sm" className="flex-1">
              <Link href={detailHref}>상세</Link>
            </Button>

            <details className="group/menu relative">
              <summary
                className="border-input text-muted-foreground hover:text-foreground inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-md border transition-colors"
                aria-label="더 보기"
              >
                <MoreHorizontal className="size-4" />
              </summary>
              <div className="bg-card absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border py-1 shadow-lg">
                <button
                  type="button"
                  onClick={prepareContact}
                  className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                >
                  <MessageSquarePlus className="size-4" />
                  연락 준비
                </button>
                {item.profileUrl ? (
                  <a
                    href={item.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                  >
                    <Instagram className="size-4" />
                    프로필 열기
                  </a>
                ) : null}
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </article>
  );
}
