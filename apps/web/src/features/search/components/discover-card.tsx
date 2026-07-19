'use client';

import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Instagram,
  Mail,
  MessageSquarePlus,
  MoreHorizontal,
  Send,
  Sparkles,
  TriangleAlert,
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
  // profileUrl wins; fall back to building one from the handle.
  const instagramUrl =
    item.profileUrl ?? (item.handle ? `https://www.instagram.com/${item.handle}/` : null);

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

      <OpportunityBody result={item} profileHref={instagramUrl} />

      {/* 진짜 영향력 신호 — 참여율 · 가짜 팔로워 의심 · 연락처(이메일) */}
      {item.engagementRate != null || item.fakeSuspect || item.email ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          {item.engagementRate != null ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                item.engagementRate >= 3
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'dark:bg-muted bg-slate-100 text-slate-600 dark:text-slate-300',
              )}
              title="팔로워 대비 최근 반응(좋아요+댓글) — 진짜 영향력 지표"
            >
              참여율 {item.engagementRate}%
            </span>
          ) : null}
          {item.fakeSuspect ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 font-medium text-rose-600 dark:text-rose-400"
              title="팔로워는 많은데 반응이 비정상적으로 적음 — 가짜 팔로워 의심"
            >
              <TriangleAlert className="size-3" />
              가짜 팔로워 의심
            </span>
          ) : null}
          {item.email ? (
            <a
              href={`mailto:${item.email}`}
              onClick={(e) => e.stopPropagation()}
              className="bg-primary/10 text-primary hover:bg-primary/15 inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 font-medium"
              title="소개글에서 찾은 이메일 — 협업 연락 채널"
            >
              <Mail className="size-3 shrink-0" />
              <span className="truncate">{item.email}</span>
            </a>
          ) : null}
        </div>
      ) : null}

      {/* AI 적합도 — why this account is (or isn't) a real fit for the brand. */}
      {item.aiVerdict ? (
        <div
          className={cn(
            'mt-4 rounded-lg border p-2.5',
            item.aiVerdict === 'fit'
              ? 'border-primary/20 bg-primary/[0.05]'
              : item.aiVerdict === 'reject'
                ? 'dark:border-border border-slate-200/70 bg-slate-50/70'
                : 'border-amber-500/20 bg-amber-500/[0.06]',
          )}
        >
          <div className="flex items-center gap-1.5">
            <Sparkles
              className={cn(
                'size-3.5',
                item.aiVerdict === 'fit'
                  ? 'text-primary'
                  : item.aiVerdict === 'reject'
                    ? 'text-slate-400'
                    : 'text-amber-600',
              )}
            />
            <span
              className={cn(
                'text-[11px] font-semibold',
                item.aiVerdict === 'fit'
                  ? 'text-primary'
                  : item.aiVerdict === 'reject'
                    ? 'text-slate-500'
                    : 'text-amber-700 dark:text-amber-500',
              )}
            >
              {item.aiVerdict === 'fit'
                ? 'AI 추천'
                : item.aiVerdict === 'reject'
                  ? 'AI 제외'
                  : 'AI 보류'}
            </span>
            {typeof item.aiScore === 'number' ? (
              <span className="text-muted-foreground text-[11px] tabular-nums">
                적합도 {item.aiScore}
              </span>
            ) : null}
          </div>
          {item.aiReason ? (
            <p className="text-foreground/80 mt-1 text-xs leading-snug">{item.aiReason}</p>
          ) : null}
        </div>
      ) : null}

      {/* 비주얼(이미지) 적합도 — 사진을 보고 판정한 옵션 결과 */}
      {item.visualVerdict ? (
        <div
          className={cn(
            'mt-2 rounded-lg border p-2.5',
            item.visualVerdict === 'fit'
              ? 'border-fuchsia-500/25 bg-fuchsia-500/[0.06]'
              : item.visualVerdict === 'reject'
                ? 'dark:border-border border-slate-200/70 bg-slate-50/70'
                : 'border-amber-500/20 bg-amber-500/[0.06]',
          )}
        >
          <div className="flex items-center gap-1.5">
            <Sparkles
              className={cn(
                'size-3.5',
                item.visualVerdict === 'fit'
                  ? 'text-fuchsia-600'
                  : item.visualVerdict === 'reject'
                    ? 'text-slate-400'
                    : 'text-amber-600',
              )}
            />
            <span
              className={cn(
                'text-[11px] font-semibold',
                item.visualVerdict === 'fit'
                  ? 'text-fuchsia-600 dark:text-fuchsia-400'
                  : item.visualVerdict === 'reject'
                    ? 'text-slate-500'
                    : 'text-amber-700 dark:text-amber-500',
              )}
            >
              {item.visualVerdict === 'fit'
                ? '비주얼 적합'
                : item.visualVerdict === 'reject'
                  ? '비주얼 부적합'
                  : '비주얼 보류'}
            </span>
            {typeof item.visualScore === 'number' ? (
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {item.visualScore}
              </span>
            ) : null}
          </div>
          {item.visualReason ? (
            <p className="text-foreground/80 mt-1 text-xs leading-snug">{item.visualReason}</p>
          ) : null}
        </div>
      ) : null}

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
