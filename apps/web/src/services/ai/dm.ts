import 'server-only';

import { type BrandContext } from './match';
import { runAi } from './run';

/**
 * AI-drafted outreach DM. The rule-based template is generic; this reads the
 * creator's actual bio/niche and writes a first-contact collab message that
 * sounds like a human who looked at their profile — the difference between a
 * DM that gets a reply and one that reads as a mass blast.
 */
export type DmCreator = {
  displayName: string;
  username: string;
  biography?: string | null;
  category?: string | null;
  followersCount?: number | null;
};

const SYSTEM = `당신은 인플루언서 마케팅 담당자입니다. 브랜드가 인스타 크리에이터에게 처음 보내는 협업 제안 DM 초안을 씁니다.

원칙:
- 한국어. 따뜻하고 정중하되 사무적이지 않게. 반말 금지, 이모지는 0~2개만.
- 그 크리에이터의 실제 콘텐츠(소개글·카테고리)를 한 번 구체적으로 언급해 "복붙이 아님"을 보여줄 것.
- 협업을 제안하되 강요하지 말 것. 조건을 단정하지 말고 "함께 이야기 나눠보고 싶다" 톤.
- 250자 이내. 흐름: 인사 → 왜 연락했는지(그들의 강점) → 가벼운 제안 → 정중한 마무리.
- 없는 사실(구체 수치·과거 협업·특정 보상)을 지어내지 말 것.

오직 DM 본문만 출력하세요. 따옴표·설명·머리말 금지.`;

export async function draftDm(
  userId: string,
  creator: DmCreator,
  brand: BrandContext | null,
): Promise<string> {
  const brandBlock =
    brand && (brand.productName || brand.brand || brand.category)
      ? [
          brand.brand ? `브랜드: ${brand.brand}` : null,
          brand.productName ? `상품: ${brand.productName}` : null,
          brand.category ? `카테고리: ${brand.category}` : null,
          brand.usp ? `차별점: ${brand.usp}` : null,
          brand.sellingPoints ? `판매 포인트: ${brand.sellingPoints}` : null,
          brand.target ? `타겟 고객: ${brand.target}` : null,
        ]
          .filter(Boolean)
          .join('\n')
      : '(브랜드 정보 없음 — 일반적인 협업 제안 톤으로)';

  const bio = (creator.biography ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const prompt = `[받는 크리에이터]
이름: ${creator.displayName} (@${creator.username})
소개: ${bio || '(없음)'}
카테고리: ${creator.category ?? '(없음)'}
팔로워: ${creator.followersCount ?? '?'}

[보내는 브랜드]
${brandBlock}

위 크리에이터에게 보낼 협업 제안 DM 초안을 써주세요.`;

  const text = await runAi(userId, { system: SYSTEM, prompt, maxTokens: 400, temperature: 0.7 });
  return text
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .slice(0, 400);
}
