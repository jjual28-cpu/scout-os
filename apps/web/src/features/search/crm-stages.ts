/**
 * CRM pipeline stages for the Kanban board. These are a display layer over the
 * existing `outreach_activities.status` text column — legacy values map in via
 * `toStage`, so NO data migration is needed. Moving a card writes `stageStored`,
 * reusing existing status strings where they exist and adding only 발견/검토/저장/협업.
 */

export type Stage = '발견' | '검토' | '저장' | '연락 준비' | '연락 완료' | '답변' | '협업' | '제외';

export const STAGE_ORDER: Stage[] = [
  '발견',
  '검토',
  '저장',
  '연락 준비',
  '연락 완료',
  '답변',
  '협업',
  '제외',
];

/** Value written to `outreach_activities.status` when a card enters a stage. */
const STORED: Record<Stage, string> = {
  발견: '발견',
  검토: '검토',
  저장: '저장',
  '연락 준비': '연락예정',
  '연락 완료': '연락완료',
  답변: '답변옴',
  협업: '협업',
  제외: '제외',
};
export function stageStored(stage: Stage): string {
  return STORED[stage];
}

/** Map any stored status (legacy or new) to a Stage. Unknown/empty → 발견. */
export function toStage(status: string | null | undefined): Stage {
  switch (status) {
    case '연락예정':
    case '연락 준비':
      return '연락 준비';
    case '연락완료':
    case '연락 완료':
      return '연락 완료';
    case '답변옴':
    case '답변':
      return '답변';
    case '제외':
      return '제외';
    case '협업':
      return '협업';
    case '저장':
      return '저장';
    case '발견':
      return '발견';
    case '검토':
    case '미검토':
    case '관심':
    case '보류':
      return '검토';
    default:
      return '발견';
  }
}

type StageStyle = { dot: string; badge: string };
export const STAGE_META: Record<Stage, StageStyle> = {
  발견: { dot: 'bg-slate-400', badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  검토: { dot: 'bg-sky-500', badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  저장: { dot: 'bg-violet-500', badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  '연락 준비': { dot: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  '연락 완료': {
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  },
  답변: {
    dot: 'bg-fuchsia-500',
    badge: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400',
  },
  협업: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  제외: { dot: 'bg-rose-500', badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
};
