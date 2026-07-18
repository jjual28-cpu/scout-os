import { AppError } from '@/lib/api/response';

/**
 * A short, user-facing reason an AI step was skipped — stored on the campaign so
 * the UI can show it instead of silently degrading. The whole point: when the AI
 * key dies or the daily cap is hit, the user should SEE why, not just get worse
 * results with no explanation.
 */
export function aiErrorMessage(err: unknown): string {
  const code = err instanceof AppError ? err.code : '';
  if (code === 'AI_NOT_CONFIGURED') {
    return 'AI가 아직 설정되지 않아 자동 판정을 건너뛰었어요. 설정 → AI 연결을 확인해 주세요.';
  }
  if (code === 'AI_LIMIT') {
    return '오늘 AI 사용 한도를 모두 써서 자동 판정을 건너뛰었어요. 내일 다시 시도해 주세요.';
  }
  return 'AI 처리 중 문제가 생겨 자동 판정을 건너뛰었어요. 결과는 기본 순서로 보여드려요.';
}
