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

      {/* Type + platform badges */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="dark:bg-muted dark:text-muted-foreground inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {result.type}
        </span>
        <span className="dark:text-muted-foreground dark:border-border inline-flex items-center gap-1 rounded-md border border-slate-200/70 px-2 py-0.5 text-xs font-medium text-slate-500">
          <PlatformIcon className="size-3" />
          {platformMeta.label}
        </span>
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
