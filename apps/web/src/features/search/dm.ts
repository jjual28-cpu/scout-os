import { type SavedOpportunity, type SearchResultType } from './types';

/**
 * Generates a MOCK first-contact DM draft. No AI/API is called — this is a
 * deterministic, hand-tuned template so drafts stay stable across regenerations.
 *
 * Quality goals:
 *   - Warm and human, NOT ad-like. No company names, no hype.
 *   - Neutral to Scout OS (the sender speaks for themselves, not a brand).
 *   - Under 250 characters.
 *   - Tone/wording varies by opportunity type (brand / seller / creator).
 *
 * Structure (always in this order):
 *   1. 자연스러운 인사
 *   2. 상대의 콘텐츠/브랜드를 보고 연락했다는 이유
 *   3. 협업 또는 제휴 가능성 제안
 *   4. 부담 없는 답장 유도
 *
 * The internal `note` and `reason` fields are intentionally excluded — they are
 * the user's private context, not something to send.
 */

const MAX_LENGTH = 250;

type Voice = 'brand' | 'seller' | 'creator';

function voiceFor(type: SearchResultType): Voice {
  switch (type) {
    case '신규 브랜드':
    case '브랜드 운영자':
      return 'brand';
    case '공구 셀러':
      return 'seller';
    case '마이크로 크리에이터':
    case '니치 크리에이터':
    default:
      return 'creator';
  }
}

const LINES: Record<Voice, { reason: string; proposal: string }> = {
  creator: {
    reason: '올려주시는 콘텐츠를 즐겨 보다가 연락드리게 됐어요.',
    proposal: '결이 잘 맞을 것 같아, 함께 해볼 만한 콘텐츠 협업이 있을지 조심스레 여쭤봐요.',
  },
  brand: {
    reason: '브랜드가 전하는 분위기를 인상 깊게 보다가 연락드리게 됐어요.',
    proposal: '서로에게 도움이 될 만한 협업이나 제휴가 있을지 이야기 나눠보고 싶어요.',
  },
  seller: {
    reason: '진행하시는 공동구매를 눈여겨보다가 연락드리게 됐어요.',
    proposal: '함께 해볼 만한 제휴가 있을지 조심스레 여쭤보고 싶어요.',
  },
};

export function generateDmDraft(item: SavedOpportunity): string {
  const name = item.name?.trim();
  const greeting = name ? `안녕하세요, ${name}님 :)` : '안녕하세요 :)';

  const { reason, proposal } = LINES[voiceFor(item.type)];
  const cta = '편하실 때 부담 없이 답장 주시면 좋겠어요. 좋은 하루 보내세요!';

  const draft = `${greeting}\n\n${reason} ${proposal}\n\n${cta}`;

  // Safety net so a draft never exceeds the length budget.
  return draft.length > MAX_LENGTH ? `${draft.slice(0, MAX_LENGTH - 1).trimEnd()}…` : draft;
}
