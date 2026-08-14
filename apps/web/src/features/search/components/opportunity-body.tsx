import {
  BookHeart,
  Check,
  ExternalLink,
  FileText,
  Instagram,
  Lightbulb,
  Music2,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  Youtube,
  type LucideIcon,
} from 'lucide-react';

import { cn, formatCompactNumber } from '@/lib/utils';

import { type SearchPlatform, type SearchResult, type SearchResultType } from '../types';

type TypeMeta = { icon: LucideIcon; chip: string };

/** 유형(카테고리)별 아이콘·칩 색. discover/saved 카드와 DM 큐가 같은 시각언어를 쓰도록 공유. */
export const TYPE_META: Record<SearchResultType, TypeMeta> = {
  '신규 브랜드': { icon: Sparkles, chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  '마이크로 크리에이터': {
    icon: Users,
    chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
  '브랜드 운영자': { icon: Store, chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  '공구 셀러': { icon: ShoppingBag, chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  '니치 크리에이터': {
    icon: BookHeart,
    chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
};

const PLATFORM_META: Record<SearchPlatform, { icon: LucideIcon; label: string }> = {
  instagram: { icon: Instagram, label: 'Instagram' },
  youtube: { icon: Youtube, label: 'YouTube' },
  tiktok: { icon: Music2, label: 'TikTok' },
  blog: { icon: FileText, label: 'Blog' },
};

/**
 * Shared, presentational rendering of an opportunity's content (identity, score,
 * badges, discovery reason, recommended action). Reused by the search result
 * card and the saved-opportunity card so the visual language stays identical.
 */
export function OpportunityBody({
  result,
  profileHref,
}: {
  result: SearchResult;
  /** When set, the avatar, name, @handle and platform badge all open this in a new tab. */
  profileHref?: string | null;
}) {
  const typeMeta = TYPE_META[result.type];
  const platformMeta = PLATFORM_META[result.platform];
  const TypeIcon = typeMeta.icon;
  const PlatformIcon = platformMeta.icon;

  // Wrap a node in an external profile link when we have one.
  const linked = (node: React.ReactNode, className?: string) =>
    profileHref ? (
      <a
        href={profileHref}
        target="_blank"
        rel="noopener noreferrer"
        title="Instagram에서 보기"
        aria-label="Instagram에서 보기"
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        {node}
      </a>
    ) : (
      node
    );

  return (
    <>
      {/* Header: identity + opportunity score */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {linked(
            result.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external IG CDN, unoptimized is fine
              <img
                src={result.profileImageUrl}
                alt={result.name}
                className="size-11 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-xl',
                  typeMeta.chip,
                )}
              >
                <TypeIcon className="size-5" />
              </div>
            ),
            'shrink-0',
          )}
          <div className="min-w-0">
            {linked(
              <h3 className="truncate text-base font-semibold tracking-tight hover:underline">
                {result.name}
              </h3>,
              'block min-w-0',
            )}
            {result.handle
              ? linked(
                  <p className="text-muted-foreground truncate text-sm hover:underline">
                    @{result.handle}
                  </p>,
                  'block min-w-0',
                )
              : null}
            {result.followersCount != null ? (
              <p className="text-muted-foreground truncate text-xs">
                팔로워 {formatCompactNumber(result.followersCount)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Type + platform badges */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="dark:bg-muted dark:text-muted-foreground inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {result.type}
        </span>
        {linked(
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold',
              profileHref
                ? // 사장님이 늘 눌러 프로필로 가는 링크 — 저장 버튼처럼 보라색으로 크게 강조
                  'bg-primary/10 text-primary ring-primary/20 hover:bg-primary/20 ring-1 transition-colors'
                : 'dark:bg-muted dark:text-muted-foreground bg-slate-100 text-slate-500',
            )}
          >
            <PlatformIcon className="size-4" />
            {platformMeta.label} 보기
          </span>,
        )}
        {/* 쇼핑몰 링크 — 바이오에 스토어/자사몰 링크가 있으면 '진짜 브랜드'의 가장 강한
            신호. 클릭하면 새 탭으로 스토어를 열어 브랜드인지 바로 확인할 수 있다. */}
        {result.externalUrl ? (
          <a
            href={
              /^https?:\/\//i.test(result.externalUrl)
                ? result.externalUrl
                : `https://${result.externalUrl}`
            }
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={(e) => e.stopPropagation()}
            title={result.externalUrl}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-sm font-medium text-emerald-600 ring-1 ring-emerald-500/20 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
          >
            <ExternalLink className="size-3.5" />
            쇼핑몰
          </a>
        ) : null}
      </div>

      {/* AI 추천 이유 chips */}
      {result.reasons && result.reasons.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {result.reasons.map((reason) => (
            <span
              key={reason}
              className="dark:border-border dark:text-muted-foreground inline-flex items-center gap-1 rounded-full border border-slate-200/70 px-2 py-0.5 text-xs font-medium text-slate-600"
            >
              <Check className="text-primary size-3" />
              {reason}
            </span>
          ))}
        </div>
      ) : null}

      {/* 발견 이유 */}
      <div className="mt-4">
        <p className="dark:text-muted-foreground text-[11px] font-medium uppercase tracking-wide text-slate-400">
          발견 이유
        </p>
        <p className="text-foreground/90 mt-1 line-clamp-3 text-sm leading-relaxed">
          {result.reason}
        </p>
      </div>

      {/* 추천 액션 */}
      <div className="dark:border-border mt-4 flex items-start gap-2 rounded-lg border border-slate-200/60 p-3">
        <Lightbulb className="dark:text-muted-foreground mt-0.5 size-4 shrink-0 text-slate-400" />
        <div>
          <p className="dark:text-muted-foreground text-[11px] font-medium uppercase tracking-wide text-slate-400">
            추천 액션
          </p>
          <p className="mt-0.5 text-sm font-medium">{result.recommendedAction}</p>
        </div>
      </div>
    </>
  );
}
