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

const REPLY_SYSTEM = `당신은 인플루언서 마케팅 담당자입니다. 셀럽이 협업 제안 DM에 보낸 답장을 읽고, 브랜드 입장에서 보낼 다음 답장 초안을 씁니다.

원칙:
- 한국어. 따뜻하고 정중하되 사무적이지 않게. 반말 금지, 이모지 0~2개.
- 상대 답장의 내용에 실제로 반응할 것(질문엔 답, 관심엔 감사, 조건 문의엔 브랜드 정보로).
- 없는 사실(구체 수치·확정 약속)을 지어내지 말 것. 애매하면 "확인 후 안내드리겠다" 톤.
- 300자 이내. 다음 행동(통화·상세 안내·자료 공유 등)을 자연스럽게 제안.

오직 답장 본문만 출력하세요. 따옴표·설명·머리말 금지.`;

/** 대화 한 줄. direction: 'in'=셀럽이 보냄, 'out'=내가 보냄. */
export type ReplyTurn = { direction: 'in' | 'out'; text: string };

/** 셀럽 답장에 대한 다음 답장 초안. 데일리 캡 1회. */
export async function draftReply(
  userId: string,
  conversation: ReplyTurn[],
  brand: BrandContext | null,
): Promise<string> {
  const brandLine =
    brand && (brand.productName || brand.brand)
      ? [
          brand.brand ? `브랜드: ${brand.brand}` : null,
          brand.productName ? `상품: ${brand.productName}` : null,
          brand.sellingPoints ? `판매 포인트: ${brand.sellingPoints}` : null,
        ]
          .filter(Boolean)
          .join('\n')
      : '(브랜드 정보 없음)';

  const convo = conversation
    .slice(-12)
    .map((t) => `${t.direction === 'in' ? '셀럽' : '나'}: ${t.text}`)
    .join('\n');

  const prompt = `[브랜드]
${brandLine}

[지금까지 대화]
${convo}

위 대화에서 셀럽의 마지막 답장에 이어 보낼 내 답장 초안을 써주세요.`;

  const text = await runAi(userId, {
    system: REPLY_SYSTEM,
    prompt,
    maxTokens: 400,
    temperature: 0.7,
  });
  return text
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .slice(0, 400);
}

const SLOT_SYSTEM = `당신은 인플루언서 마케팅 담당자입니다. 사용자가 만든 DM 템플릿의 "AI 구간"들을 그 크리에이터에 맞게 자연스럽게 채웁니다.

원칙:
- 한국어. 따뜻하고 정중하되 사무적이지 않게. 반말 금지.
- 각 구간의 지시에 맞는 문장(들)만 씁니다. 인사말·서명·조건 같은 템플릿의 다른 부분은 절대 다시 쓰지 마세요 (그건 이미 템플릿에 있음).
- **절대 "안녕하세요"·"○○님" 같은 인사/호칭으로 시작하지 마세요.** 템플릿 앞부분에 이미 인사가 있어 중복됩니다. 곧바로 지시 내용(예: 칭찬 문장)만 쓰세요.
- 크리에이터의 실제 콘텐츠(소개글·카테고리)를 근거로, "복붙이 아님"이 드러나게. 없는 사실은 지어내지 말 것.
- 지정된 개수만큼, 순서대로.

오직 JSON 배열만 출력하세요. 설명·번호·따옴표 밖 텍스트 금지.
형식: ["구간1 텍스트","구간2 텍스트"]`;

/* eslint-disable @typescript-eslint/no-explicit-any -- model output is untyped JSON */
/**
 * DM 템플릿의 AI 구간들을 한 번의 AI 호출로 채운다. `slots`(지시 배열) 순서대로
 * 텍스트 배열을 반환한다(길이 맞춰 패딩). 데일리 캡에 1회 카운트.
 */
export async function fillTemplateSlots(
  userId: string,
  creator: DmCreator,
  brand: BrandContext | null,
  slots: string[],
): Promise<string[]> {
  if (slots.length === 0) return [];

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
      : '(브랜드 정보 없음)';

  const bio = (creator.biography ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const slotList = slots.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const prompt = `[받는 크리에이터]
이름: ${creator.displayName} (@${creator.username})
소개: ${bio || '(없음)'}
카테고리: ${creator.category ?? '(없음)'}
팔로워: ${creator.followersCount ?? '?'}

[보내는 브랜드]
${brandBlock}

[채울 AI 구간 ${slots.length}개 — 각 지시대로]
${slotList}

각 구간을 순서대로 채워 JSON 배열로만 답하세요.`;

  const text = await runAi(userId, {
    system: SLOT_SYSTEM,
    prompt,
    json: true,
    maxTokens: 700,
    temperature: 0.7,
  });

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  let arr: string[] = [];
  if (start >= 0 && end > start) {
    try {
      const raw = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(raw)) {
        arr = raw.map((v: any) => (typeof v === 'string' ? v.trim() : ''));
      }
    } catch {
      arr = [];
    }
  }
  // 슬롯 개수에 맞춰 패딩/절단 (조립 시 자리 어긋남 방지).
  return slots.map((_, i) => arr[i] ?? '');
}
/* eslint-enable @typescript-eslint/no-explicit-any */
