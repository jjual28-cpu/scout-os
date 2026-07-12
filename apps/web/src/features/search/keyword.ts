/** Emoji for a search-keyword badge. Falls back to a generic 🔎 for unknown terms. */
const KEYWORD_EMOJI: Record<string, string> = {
  뷰티: '💄',
  화장품: '💄',
  건강: '🩺',
  헬스: '💪',
  피트니스: '💪',
  운동: '🏋️',
  캠핑: '🏕️',
  반려동물: '🐶',
  강아지: '🐶',
  고양이: '🐱',
  육아: '🍼',
  골프: '⛳',
  카페: '☕',
  커피: '☕',
  맛집: '🍽️',
  음식: '🍽️',
  요리: '🍳',
  여행: '✈️',
  패션: '👗',
  뷰티브랜드: '💄',
  인테리어: '🛋️',
  독서: '📚',
  게임: '🎮',
  음악: '🎵',
};

export function keywordEmoji(keyword: string): string {
  return KEYWORD_EMOJI[keyword.trim()] ?? '🔎';
}
