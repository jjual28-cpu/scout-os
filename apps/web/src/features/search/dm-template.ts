/**
 * "나만의 DM 스타일" 템플릿 유틸 (순수 함수, AI/네트워크 없음).
 *
 * 템플릿 = 고정 문구 + 변수 + AI 구간:
 *   - 변수:   {셀럽} {상품} {브랜드}  → 값으로 치환
 *   - AI 구간: [[ai: 지시]]          → 그 셀럽에 맞게 AI가 생성한 문장으로 치환
 *   - 나머지는 사용자가 쓴 고정 문구 그대로
 *
 * 생성 흐름: fillVariables → extractAiSlots → (AI 호출) → replaceAiSlots
 */

export const DM_TEMPLATE_VARS = ['셀럽', '상품', '브랜드'] as const;

/** 처음 여는 사람을 위한 기본 예시 템플릿(오너 예시 기반, 조건은 예시값). */
export const DEFAULT_DM_TEMPLATE = `안녕하세요, {셀럽}님! 😊
저는 {브랜드}에서 브랜드 및 셀럽 협업을 담당하고 있습니다.
[[ai: {셀럽}의 콘텐츠 분위기·결을 구체적으로 한 문장 칭찬]]
계정을 보다가 콘텐츠와 {상품}이(가) 정말 잘 어울릴 것 같아 조심스럽게 협업을 제안드립니다.

협업은 1개월 단위로 진행되며 주요 내용은 아래와 같습니다.
✔ 제품 무상 제공
✔ 판매 발생 시 30% 수익쉐어 지급
✔ 최소 월 4회 콘텐츠 업로드 (릴스 / 숏츠 / 피드)
✔ 콘텐츠 내 판매 링크 첨부

[[ai: 관심 있으면 편하게 답장 달라는 정중하고 따뜻한 마무리 2문장]]`;

const AI_SLOT_RE = /\[\[ai:\s*([\s\S]*?)\]\]/gi;

/** 변수({셀럽}/{상품}/{브랜드})를 값으로 치환. 값이 없으면 원형 유지. */
export function fillVariables(template: string, vars: Partial<Record<string, string>>): string {
  return template.replace(/\{(셀럽|상품|브랜드)\}/g, (_all, key: string) => {
    const v = vars[key];
    return v && v.trim() ? v : `{${key}}`;
  });
}

/** 템플릿의 AI 구간 지시들을 등장 순서대로 추출. */
export function extractAiSlots(template: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  AI_SLOT_RE.lastIndex = 0;
  while ((m = AI_SLOT_RE.exec(template)) !== null) out.push((m[1] ?? '').trim());
  return out;
}

/** AI 구간을 생성된 텍스트로 순서대로 치환. 부족하면 빈 문자열. */
export function replaceAiSlots(template: string, aiTexts: string[]): string {
  let i = 0;
  return template
    .replace(AI_SLOT_RE, () => (aiTexts[i++] ?? '').trim())
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 편집기 미리보기용 — 변수 치환 + AI 구간은 자리표시자로. */
export function previewTemplate(template: string, vars: Partial<Record<string, string>>): string {
  return fillVariables(template, vars)
    .replace(AI_SLOT_RE, '✨(AI가 이 셀럽에 맞게 채웁니다)')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 이 템플릿에 AI 구간이 하나라도 있는지. */
export function hasAiSlots(template: string): boolean {
  AI_SLOT_RE.lastIndex = 0;
  return AI_SLOT_RE.test(template);
}
