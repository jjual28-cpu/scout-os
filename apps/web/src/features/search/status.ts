import { type ContactStatus, type OpportunityStatus } from './types';

/** Canonical status order used for pills and filters. */
export const STATUS_ORDER: OpportunityStatus[] = ['미검토', '관심', '보류', '제외', '연락예정'];

/** Default status assigned when an opportunity is first saved. */
export const DEFAULT_STATUS: OpportunityStatus = '미검토';

/** Filter options for the /saved toolbar ('전체' + every status). */
export const FILTER_OPTIONS = ['전체', ...STATUS_ORDER] as const;
export type StatusFilter = (typeof FILTER_OPTIONS)[number];

type StatusStyle = {
  /** Classes for the active pill / status badge. */
  active: string;
  /** Small dot colour for compact indicators. */
  dot: string;
};

export const STATUS_META: Record<OpportunityStatus, StatusStyle> = {
  미검토: {
    active: 'border-transparent bg-secondary text-secondary-foreground',
    dot: 'bg-muted-foreground',
  },
  관심: {
    active: 'border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  보류: {
    active: 'border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  제외: {
    active: 'border-transparent bg-rose-500/15 text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  연락예정: {
    active: 'border-transparent bg-sky-500/15 text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500',
  },
};

/** Contact lifecycle statuses (outreach flow) — order used for the detail selector. */
export const CONTACT_STATUS_ORDER: ContactStatus[] = [
  '미검토',
  '관심',
  '보류',
  '제외',
  '연락예정',
  '연락완료',
  '답변옴',
];

export const CONTACT_STATUS_META: Record<ContactStatus, StatusStyle> = {
  ...STATUS_META,
  연락완료: {
    active: 'border-transparent bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500',
  },
  답변옴: {
    active: 'border-transparent bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400',
    dot: 'bg-fuchsia-500',
  },
};
