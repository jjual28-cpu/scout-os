import { toStage, type Stage } from './crm-stages';

/** Stages hidden by default in search results (already-handled creators). */
export const DEFAULT_HIDDEN_STAGES = new Set<Stage>(['연락 완료', '답변', '협업', '제외']);

export function isDefaultHidden(status: string | null | undefined): boolean {
  return DEFAULT_HIDDEN_STAGES.has(toStage(status));
}

const BADGE =
  'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium';

/** A CRM-status badge for a creator card. Returns null when there's nothing to show. */
export function creatorBadge(
  status: string | null | undefined,
  hasDmDraft: boolean,
): { label: string; className: string } | null {
  switch (toStage(status)) {
    case '연락 완료':
      return {
        label: '✉ 이미 연락함',
        className: `${BADGE} bg-indigo-500/15 text-indigo-600 dark:text-indigo-400`,
      };
    case '답변':
      return {
        label: '💬 답변옴',
        className: `${BADGE} bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400`,
      };
    case '협업':
      return {
        label: '🤝 협업중',
        className: `${BADGE} bg-emerald-500/15 text-emerald-600 dark:text-emerald-400`,
      };
    case '제외':
      return {
        label: '🚫 제외',
        className: `${BADGE} bg-rose-500/15 text-rose-600 dark:text-rose-400`,
      };
    default:
      return hasDmDraft
        ? { label: 'DM 준비됨', className: `${BADGE} bg-primary/10 text-primary` }
        : null;
  }
}
