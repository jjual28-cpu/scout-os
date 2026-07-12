/**
 * First-contact / follow-up DM drafts for a real Instagram creator.
 *
 * No AI/API — deterministic templates so drafts are stable and instant. Uses the
 * creator's real context (name, bio, category, follower tier, discovery reason)
 * to vary the copy, while keeping the SAME warm, human, non-ad tone as the rest
 * of the app. Always under 250 characters. `variant` rotates phrasing so the
 * "다시 생성" button produces a genuinely different draft.
 */

const MAX_LENGTH = 250;

export type CreatorDmInput = {
  displayName: string;
  username: string;
  biography?: string | null;
  category?: string | null;
  followersCount?: number | null;
  /** 발견 이유 — internal context; used only to pick a warm hook, never quoted verbatim. */
  reason?: string | null;
};

/** Pull a short, human interest phrase from category or bio (never a raw dump). */
function interestHook(input: CreatorDmInput): string | null {
  const cat = input.category?.trim();
  if (cat) return cat;
  const bio = input.biography?.trim();
  if (!bio) return null;
  // First short, clean segment of the bio (split on common separators / newlines).
  const seg = bio
    .split(/[\n·|/•,–-]/)[0]
    ?.replace(/[#@][^\s]+/g, '')
    .trim();
  if (seg && seg.length >= 2 && seg.length <= 18) return seg;
  return null;
}

const OPENERS = [
  (hook: string | null) =>
    hook
      ? `${hook} 관련해서 올려주시는 게시물을 즐겨 보다가 연락드리게 됐어요.`
      : '올려주시는 게시물을 즐겨 보다가 연락드리게 됐어요.',
  (hook: string | null) =>
    hook
      ? `평소 ${hook} 콘텐츠를 눈여겨보다가 인사드리고 싶어 연락드려요.`
      : '평소 콘텐츠를 눈여겨보다가 인사드리고 싶어 연락드려요.',
  (hook: string | null) =>
    hook
      ? `${hook} 이야기를 담아내시는 결이 좋아서 연락드리게 됐어요.`
      : '담아내시는 결이 좋아서 연락드리게 됐어요.',
];

const PROPOSALS = [
  '결이 잘 맞을 것 같아, 함께 해볼 만한 콘텐츠 협업이 있을지 조심스레 여쭤봐요.',
  '서로에게 도움이 될 만한 협업이 있을지 편하게 이야기 나눠보고 싶어요.',
  '작게라도 함께 해볼 만한 게 있을지 가볍게 제안드려보고 싶어요.',
];

const CTAS = [
  '편하실 때 부담 없이 답장 주시면 좋겠어요. 좋은 하루 보내세요!',
  '관심 있으시면 언제든 편하게 답장 주세요. 감사합니다 :)',
  '부담 갖지 마시고 편하게 회신 주시면 반가울 것 같아요. 좋은 하루 되세요!',
];

function clamp(text: string): string {
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1).trimEnd()}…` : text;
}

/** A warm first-contact DM. */
export function generateCreatorDm(input: CreatorDmInput, variant = 0): string {
  const name = input.displayName?.trim() || input.username?.trim();
  const greeting = name ? `안녕하세요, ${name}님 :)` : '안녕하세요 :)';

  const i = ((variant % OPENERS.length) + OPENERS.length) % OPENERS.length;
  const hook = interestHook(input);
  const opener = OPENERS[i]!(hook);
  const proposal = PROPOSALS[i]!;
  const cta = CTAS[i]!;

  return clamp(`${greeting}\n\n${opener} ${proposal}\n\n${cta}`);
}

/** A softer follow-up DM for someone already contacted (no reply yet). */
export function generateCreatorFollowUpDm(input: CreatorDmInput, variant = 0): string {
  const name = input.displayName?.trim() || input.username?.trim();
  const greeting = name ? `${name}님, 안녕하세요 :)` : '안녕하세요 :)';
  const hook = interestHook(input);
  const lines = [
    `${hook ? `${hook} ` : ''}지난번에 조심스레 연락드렸었는데, 혹시 편하실 때 한 번 봐주셨을까 해서 가볍게 다시 인사드려요.`,
    '지난번 메시지에 이어 한 번 더 조심스레 인사드려요. 여전히 함께 해보고 싶은 마음이 있어서요.',
    '바쁘실 텐데 이렇게 다시 연락드려 조심스러워요. 그래도 인연이 닿으면 좋겠다는 생각에 한 번 더 인사드립니다.',
  ];
  const i = ((variant % lines.length) + lines.length) % lines.length;
  const cta = '부담 갖지 마시고 편하실 때 답장 주시면 감사하겠습니다. 좋은 하루 보내세요!';
  return clamp(`${greeting}\n\n${lines[i]!}\n\n${cta}`);
}
