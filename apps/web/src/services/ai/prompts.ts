import 'server-only';

import { type Creator } from '@scout-os/database';

/**
 * Centralised prompt templates. Keeping them in one module makes tone/quality
 * iteration easy and keeps prompt engineering out of business logic.
 */

export const SYSTEM_ANALYST = `You are Scout OS, an AI business-development analyst.
You evaluate creators, brands, and sellers as collaboration opportunities for a marketing team.
Be concise, concrete, and honest about risks. Respond in Korean.`;

export const SYSTEM_OUTREACH = `You are Scout OS, writing first-contact outreach on behalf of a brand.
Write warm, specific, non-spammy messages that reference the creator's actual content.
Keep it short. Respond in Korean.`;

export function creatorAnalysisPrompt(
  creator: Pick<
    Creator,
    'displayName' | 'category' | 'niches' | 'totalFollowers' | 'avgEngagement'
  >,
) {
  return `다음 크리에이터를 협업 관점에서 평가해줘.
이름: ${creator.displayName}
카테고리: ${creator.category ?? '미상'}
니치: ${creator.niches.join(', ') || '미상'}
팔로워: ${creator.totalFollowers ?? '미상'}
평균 참여율: ${creator.avgEngagement ?? '미상'}%

다음 JSON 형식으로만 답해:
{ "score": 0-100, "summary": "한 문장", "strengths": [], "risks": [], "suggestedAngle": "협업 각도" }`;
}

export function outreachDmPrompt(params: {
  creatorName: string;
  brandName: string;
  angle: string;
  tone: 'friendly' | 'professional' | 'casual';
}) {
  return `크리에이터 "${params.creatorName}"에게 보낼 첫 DM을 작성해줘.
브랜드: ${params.brandName}
협업 각도: ${params.angle}
톤: ${params.tone}
2~4문장, 이모지는 최대 1개.`;
}
