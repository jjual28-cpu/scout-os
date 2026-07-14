import { type CampaignLabel } from './types';

/** Display metadata for each workflow Label (color derives from the label). */
export const LABEL_META: Record<
  CampaignLabel,
  { label: string; emoji: string; className: string; dot: string }
> = {
  active: {
    label: '진행중',
    emoji: '🟢',
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  hold: {
    label: '보류',
    emoji: '🟡',
    className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  done: {
    label: '완료',
    emoji: '🔵',
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  failed: {
    label: '실패',
    emoji: '🔴',
    className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
};

export const LABEL_ORDER: CampaignLabel[] = ['active', 'hold', 'done', 'failed'];

/** Coerce an unknown DB value to a valid label. */
export function toLabel(value: string | null | undefined): CampaignLabel {
  return value === 'hold' || value === 'done' || value === 'failed' ? value : 'active';
}
