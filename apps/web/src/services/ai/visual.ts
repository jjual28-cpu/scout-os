import 'server-only';

import { env } from '@/lib/env';

import { runAi } from './run';

/**
 * 비주얼(이미지) 셀럽 판정 — 옵션.
 *
 * 오너가 지정한 **제품 관련 시각 기준**(예: "머리 길고 윤기나는 여성")에 셀럽의
 * 사진이 맞는지 비전 AI가 판단한다. 책임 범위: 그 기준에만 답하고, 외모 전반·몸매·
 * 매력도 일반 평가나 인종·나이 등 편향 판단은 하지 않는다. 콜라보 적합성 신호일 뿐,
 * 최종 선택은 사람이 한다.
 */

export type VisualCandidate = {
  username: string;
  /** 프로필 + 게시물 이미지 URL (이미 수집). */
  images: string[];
};

export type VisualVerdict = {
  username: string;
  score: number; // 0~100
  verdict: 'fit' | 'maybe' | 'reject';
  reason: string;
};

const SYSTEM = `당신은 인플루언서 마케팅 담당자입니다. 브랜드가 제시한 "제품 관련 시각 기준"에 이 크리에이터의 사진이 맞는지 판단합니다.

반드시 지킬 것:
- 오직 주어진 시각 기준에만 답하세요. 외모 전반·몸매·매력도를 일반적으로 평가하지 마세요. 인종·나이·체형 등으로 차별·서열화하지 마세요.
- 사진에서 그 기준과 직접 관련된 요소(예: 머리 길이·머릿결, 착장/스타일, 손·네일 등)만 봅니다.
- 사람이 잘 안 보이거나 관련 요소가 사진에 없으면 확신을 낮게 (낮은 점수, verdict maybe/reject).
- reason 은 한국어 한 줄(35자 이내), 사진에서 실제로 본 근거만. 추측·과장 금지.

점수: 90+ 기준에 매우 부합 / 70~89 부합 / 40~69 애매 / 40 미만 부적합.
오직 JSON만 출력: {"score":0~100,"verdict":"fit|maybe|reject","reason":"..."}`;

/* eslint-disable @typescript-eslint/no-explicit-any -- model output is untyped JSON */
function parseVerdict(username: string, text: string): VisualVerdict | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let raw: any;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const n = Number(raw?.score);
  const score = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50;
  const v = raw?.verdict;
  const verdict: VisualVerdict['verdict'] =
    v === 'fit' || v === 'maybe' || v === 'reject'
      ? v
      : score >= 70
        ? 'fit'
        : score >= 40
          ? 'maybe'
          : 'reject';
  const reason = typeof raw?.reason === 'string' ? raw.reason.trim().slice(0, 60) : '';
  return { username, score, verdict, reason };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * 후보들을 비주얼 기준으로 판정. 셀럽마다 1회 비전 호출(프로필+게시물 사진).
 * 각 호출이 데일리 AI 캡에 카운트된다(비용 반영). 실패한 후보는 결과에서 빠진다.
 */
export async function judgeVisual(
  userId: string,
  candidates: VisualCandidate[],
  criteria: string,
): Promise<Map<string, VisualVerdict>> {
  const model = env.OPENROUTER_VISION_MODEL;
  const results = await Promise.all(
    candidates.map(async (c): Promise<VisualVerdict | null> => {
      const images = c.images.filter(Boolean).slice(0, 3);
      if (images.length === 0) return null; // 사진 없으면 판정 불가
      try {
        const text = await runAi(userId, {
          model,
          system: SYSTEM,
          prompt: `[제품 관련 시각 기준]\n${criteria}\n\n이 크리에이터(@${c.username})의 사진을 보고 위 기준에 얼마나 맞는지 판단하세요.`,
          images,
          json: true,
          maxTokens: 160,
          temperature: 0.2,
        });
        return parseVerdict(c.username, text);
      } catch {
        return null;
      }
    }),
  );

  const map = new Map<string, VisualVerdict>();
  for (const r of results) if (r) map.set(r.username.toLowerCase(), r);
  return map;
}
