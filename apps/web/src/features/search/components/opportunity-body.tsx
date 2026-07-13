import {
  BookHeart,
  Check,
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

const TYPE_META: Record<SearchResultType, TypeMeta> = {
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
export function OpportunityBody({ result }: { result: SearchResult }) {
  const typeMeta = TYPE_META[result.type];
  const platformMeta = PLATFORM_META[result.platform];
  const TypeIcon = typeMeta.icon;
  const PlatformIcon = platformMeta.icon;

  return (
    <>
      {/* Header: identity + opportunity score */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {result.profileImageUrl ? (
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
          )}
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight">{result.name}</h3>
            {result.handle ? (
              <p className="text-muted-foreground truncate text-sm">@{result.handle}</p>
            ) : null}
            {result.followersCount != null ? (
              <p className="text-muted-foreground truncate text-xs">
                팔로워 {formatCompactNumber(result.followersCount)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* AI 추천 이유 (점수 대신) */}
      {result.reasons && result.reasons.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {result.reasons.map((reason) => (
            <span
              key={reason}
              className="border-primary/20 bg-primary/5 text-primary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
            >
              <Check className="size-3" />
              {reason}
            </span>
          ))}
        </div>
      ) : null}

      {/* Type + platform badges */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="bg-secondary text-secondary-foreground inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium">
          {result.type}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium">
          <PlatformIcon className="size-3" />
          {platformMeta.label}
        </span>
      </div>

      {/* 발견 이유 */}
      <div className="mt-4">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          발견 이유
        </p>
        <p className="text-foreground/90 mt-1 line-clamp-3 text-sm leading-relaxed">
          {result.reason}
        </p>
      </div>

      {/* 추천 액션 */}
      <div className="border-primary/15 bg-primary/5 mt-4 flex items-start gap-2 rounded-lg border p-3">
        <Lightbulb className="text-primary mt-0.5 size-4 shrink-0" />
        <div>
          <p className="text-primary/80 text-[11px] font-medium uppercase tracking-wide">
            추천 액션
          </p>
          <p className="mt-0.5 text-sm font-medium">{result.recommendedAction}</p>
        </div>
      </div>
    </>
  );
}
