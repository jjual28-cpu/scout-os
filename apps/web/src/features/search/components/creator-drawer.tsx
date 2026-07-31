'use client';

import {
  Check,
  Copy,
  History,
  Inbox,
  Instagram,
  Loader2,
  MessageSquareText,
  Send,
  Sparkles,
  Tag,
  Wand2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/features/products/hooks/use-products';
import { cn, formatCompactNumber } from '@/lib/utils';

import { generateCreatorDm } from '../creator-dm';
import { generateAiDm, generateStyledDm } from '../dm-generate';
import { STAGE_META, STAGE_ORDER, stageStored, toStage, type Stage } from '../crm-stages';
import { useInboxReplyMap, replyKey } from '../hooks/use-inbox-reply-map';
import { useDmTemplate } from '../hooks/use-dm-template';
import { useOutreach } from '../hooks/use-outreach';
import { DmStyleDialog } from './dm-style-dialog';
import { TagEditor } from './tag-editor';

export type BoardCard = {
  id: string;
  name: string;
  username: string;
  platform: string;
  followersCount: number | null;
  profileImageUrl: string | null;
  profileUrl: string;
  tag: string;
  bio: string;
  stage: Stage;
  contactedAt: string | null;
  followUpAt: string | null;
  note: string;
  replyStatus: string | null;
  tags: string[];
  /** 인박스로 받은 최신 답장(있으면 카드에 자동 표시). */
  reply: { text: string; unread: number } | null;
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  } catch {
    return '—';
  }
}

export function CreatorDrawer({
  card,
  onClose,
  onError,
}: {
  card: BoardCard | null;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const outreach = useOutreach();
  const { template: dmTemplate } = useDmTemplate();
  const { products } = useProducts();
  const { map: replyMap } = useInboxReplyMap();
  const record = card ? outreach.get(card.id) : null;
  const inboxReply = card ? (replyMap.get(replyKey(card.id)) ?? null) : null;

  const [draft, setDraft] = useState('');
  const [variant, setVariant] = useState(0);
  const [copied, setCopied] = useState(false);
  const [genKind, setGenKind] = useState<'ai' | 'style' | null>(null);
  const [dmProductId, setDmProductId] = useState('');
  const [styleOpen, setStyleOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (card && record) {
      setDraft(record.dmDraft ?? '');
      setNoteDraft(record.note ?? '');
      setVariant(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id]);

  if (!card || !record) return null;

  const dmInput = {
    displayName: card.name,
    username: card.username,
    biography: card.bio,
    category: card.tag,
    followersCount: card.followersCount,
    reason: card.bio,
  };
  const creatorForDm = {
    displayName: card.name,
    username: card.username,
    biography: card.bio,
    category: card.tag,
    followersCount: card.followersCount,
  };
  const dmProduct = products.find((p) => p.id === dmProductId) ?? null;
  const brandForDm = dmProduct
    ? {
        productName: dmProduct.name,
        brand: dmProduct.brand,
        category: dmProduct.category,
        usp: dmProduct.usp,
        sellingPoints: dmProduct.sellingPoints,
        target: dmProduct.target,
      }
    : null;
  // 두 갈래를 명확히: 'ai' = AI가 통째로 작성 / 'style' = 저장한 내 DM 스타일 틀 사용.
  const runGen = async (kind: 'ai' | 'style') => {
    if (genKind) return;
    const v = variant + 1;
    setVariant(v);
    const fallback = generateCreatorDm(dmInput, v);
    setGenKind(kind);
    try {
      const { text } =
        kind === 'style'
          ? await generateStyledDm({
              template: dmTemplate,
              creator: creatorForDm,
              brand: brandForDm,
              fallback,
            })
          : await generateAiDm({ creator: creatorForDm, brand: brandForDm, fallback });
      setDraft(text);
      outreach.setDmDraft(card.id, text);
    } finally {
      setGenKind(null);
    }
  };
  const copy = async (open: boolean) => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
    if (open) window.open(card.profileUrl, '_blank', 'noopener,noreferrer');
  };
  const onNote = (v: string) => {
    setNoteDraft(v);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => outreach.setNote(card.id, v), 600);
  };
  const move = async (stage: Stage) => {
    const ok = await outreach.setStageSafe(card.id, stageStored(stage));
    if (!ok) onError('상태 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
  };

  const activeStage = record ? toStage(record.status) : card.stage;

  const timeline: { label: string; when: string }[] = [];
  if (record.contactedAt) timeline.push({ label: 'DM 전송', when: fmt(record.contactedAt) });
  if (record.replyStatus === '답변옴') timeline.push({ label: '답변 받음', when: '' });
  if (record.followUpAt) timeline.push({ label: '후속 예정', when: record.followUpAt });
  timeline.push({ label: `현재 · ${activeStage}`, when: '' });

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="bg-background dark:border-border fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200/60 shadow-2xl">
        {/* Header */}
        <div className="dark:border-border flex items-start gap-3 border-b border-slate-200/60 p-5">
          <Avatar className="size-12">
            {card.profileImageUrl ? (
              <AvatarImage src={card.profileImageUrl} alt={card.name} />
            ) : null}
            <AvatarFallback>{card.name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{card.name}</p>
            <p className="text-muted-foreground truncate text-sm">@{card.username}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {card.platform}
              {card.followersCount != null
                ? ` · 팔로워 ${formatCompactNumber(card.followersCount)}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {card.bio ? (
            <p className="text-foreground/90 whitespace-pre-line text-sm leading-relaxed">
              {card.bio}
            </p>
          ) : null}

          {/* 받은 답장 (인박스 자동연동) */}
          {inboxReply ? (
            <div className="border-primary/25 bg-primary/[0.04] rounded-xl border p-3.5">
              <div className="flex items-center gap-1.5">
                <MessageSquareText className="text-primary size-4" />
                <p className="text-sm font-semibold">받은 답장</p>
                {inboxReply.unread > 0 ? (
                  <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                    새 {inboxReply.unread}
                  </span>
                ) : null}
              </div>
              <p className="text-foreground/90 mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed">
                {inboxReply.text || '(내용 없음)'}
              </p>
              <Button asChild size="sm" className="mt-2.5">
                <Link href="/inbox">
                  <Inbox className="size-4" />
                  인박스에서 답장
                </Link>
              </Button>
            </div>
          ) : null}

          {/* Stage */}
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium">상태</p>
            <div className="flex flex-wrap gap-1.5">
              {STAGE_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void move(s)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    activeStage === s
                      ? STAGE_META[s].badge
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <p className="text-muted-foreground mb-1.5 text-xs font-medium">메모 (자동 저장)</p>
            <textarea
              value={noteDraft}
              onChange={(e) => onNote(e.target.value)}
              rows={2}
              placeholder="내부 메모…"
              className="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
          </div>

          {/* Tags */}
          <div>
            <p className="text-muted-foreground mb-1.5 flex items-center gap-1 text-xs font-medium">
              <Tag className="size-3.5" />
              태그
            </p>
            <TagEditor tags={record.tags} onChange={(next) => outreach.setTags(card.id, next)} />
          </div>

          {/* DM */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-medium">DM 초안</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-primary/40 text-primary h-7 px-2"
                onClick={() => setStyleOpen(true)}
              >
                <Wand2 className="size-3.5" />
                {dmTemplate.trim() ? '내 DM 스타일 수정' : '내 DM 스타일 만들기'}
              </Button>
            </div>
            {/* 어떤 상품으로 보낼지 — {상품}/{상품설명} 채움. 안 고르면 상품 없이. */}
            {products.length > 0 ? (
              <select
                value={dmProductId}
                onChange={(e) => setDmProductId(e.target.value)}
                className="border-input bg-background focus-visible:ring-ring mb-2 h-8 w-full rounded-lg border px-2 text-xs outline-none focus-visible:ring-2"
              >
                <option value="">상품 없이 (협업 제안만)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || '(이름 없음)'}
                  </option>
                ))}
              </select>
            ) : null}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => outreach.setDmDraft(card.id, e.target.value)}
              rows={5}
              placeholder="‘초안 생성’으로 맞춤 DM을 만들어 보세요."
              className="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void runGen('ai')}
                disabled={genKind !== null}
              >
                {genKind === 'ai' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                AI DM 생성
              </Button>
              {dmTemplate.trim() ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void runGen('style')}
                  disabled={genKind !== null}
                  className="border-primary/40 text-primary"
                >
                  {genKind === 'style' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wand2 className="size-4" />
                  )}
                  내 스타일 DM
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="outline" onClick={() => copy(false)}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? '복사됨' : '복사'}
              </Button>
              <Button type="button" size="sm" variant="default" onClick={() => copy(true)}>
                <Instagram className="size-4" />
                Instagram에서 연락
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  outreach.markContacted(card.id);
                }}
              >
                <Send className="size-4" />
                연락 완료
              </Button>
            </div>
          </div>

          {/* Follow-up */}
          <div>
            <p className="text-muted-foreground mb-1.5 text-xs font-medium">후속 연락 예정일</p>
            <input
              type="date"
              value={record.followUpAt ?? ''}
              onChange={(e) => outreach.setFollowUpAt(card.id, e.target.value || null)}
              className="border-input bg-background focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-sm outline-none focus-visible:ring-2"
            />
            <p className="text-muted-foreground mt-2 text-xs">
              최근 연락 {fmt(record.contactedAt)} · 연락 {record.contactCount}회
            </p>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium">
              <History className="size-3.5" />
              타임라인
            </p>
            <ol>
              {timeline.map((e, i) => (
                <li key={`${e.label}-${i}`} className="flex gap-2 pb-2 last:pb-0">
                  <span className="bg-primary mt-1 size-1.5 shrink-0 rounded-full" />
                  <div className="-mt-0.5">
                    <p className="text-sm">{e.label}</p>
                    {e.when ? <p className="text-muted-foreground text-xs">{e.when}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="dark:border-border border-t border-slate-200/60 p-4">
          <Button asChild variant="outline" className="w-full">
            <Link href={`/creators/${encodeURIComponent(card.id)}`}>자세히 보기</Link>
          </Button>
        </div>
      </aside>
      <DmStyleDialog open={styleOpen} onClose={() => setStyleOpen(false)} />
    </>
  );
}
