'use client';

import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  Copy,
  History,
  Instagram,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Send,
  Sparkles,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn, formatCompactNumber } from '@/lib/utils';

import { useProducts } from '@/features/products/hooks/use-products';

import { generateCreatorDm, generateCreatorFollowUpDm } from '../creator-dm';
import { generateAiDm, generateStyledDm } from '../dm-generate';
import { DmStyleDialog } from './dm-style-dialog';
import { useCreator } from '../hooks/use-creator';
import { useDmTemplate } from '../hooks/use-dm-template';
import { useOutreach } from '../hooks/use-outreach';
import { CONTACT_STATUS_META, CONTACT_STATUS_ORDER } from '../status';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function CreatorDetail({ id }: { id: string }) {
  const { status: loadStatus, creator, updatedAt } = useCreator(id);
  const outreach = useOutreach();
  const record = outreach.get(id);

  // DM draft is edited locally, persisted on explicit actions / blur.
  const [draft, setDraft] = useState<string | null>(null);
  const [dmVariant, setDmVariant] = useState(0);
  const [copied, setCopied] = useState(false);
  const [aiLoading, setAiLoading] = useState<'ai' | 'style' | false>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);

  // DM 스타일 템플릿 + 어느 상품으로 보낼지(변수 {상품}/{브랜드} 채움).
  const { template: dmTemplate } = useDmTemplate();
  const { products } = useProducts();
  const [dmProductId, setDmProductId] = useState<string>('');
  // 사용자가 고른 상품만 사용. 예전엔 products[0]로 폴백해서, 구강케어로 찾은 셀럽에게도
  // 목록 첫 상품(예: 메이크업박스) DM이 나가던 버그가 있었다 → 폴백 제거.
  const dmProduct = products.find((p) => p.id === dmProductId) ?? null;

  // Notes: controlled + debounced autosave.
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (draft === null && outreach.hydrated) setDraft(record.dmDraft ?? '');
  }, [draft, outreach.hydrated, record.dmDraft]);

  useEffect(() => {
    if (noteDraft === null && outreach.hydrated) setNoteDraft(record.note ?? '');
  }, [noteDraft, outreach.hydrated, record.note]);

  const onNoteChange = (v: string) => {
    setNoteDraft(v);
    setNoteSaved(false);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      outreach.setNote(id, v);
      setNoteSaved(true);
    }, 600);
  };

  if (loadStatus === 'loading') {
    return <Shell>불러오는 중…</Shell>;
  }
  if (loadStatus === 'unavailable') {
    return (
      <Shell>
        로그인 후 이용할 수 있어요. 실제 크리에이터 데이터는 계정에 연결되어 표시됩니다.
      </Shell>
    );
  }
  if (loadStatus === 'notfound' || !creator) {
    return <Shell>해당 크리에이터를 찾을 수 없어요. /discover에서 다시 확인해 주세요.</Shell>;
  }

  const dmInput = {
    displayName: creator.displayName,
    username: creator.username,
    biography: creator.biography,
    category: creator.category,
    followersCount: creator.followersCount,
    reason: creator.biography,
  };

  const regenDraft = () => {
    const v = dmVariant + 1;
    setDmVariant(v);
    const next = generateCreatorDm(dmInput, v);
    setDraft(next);
    outreach.setDmDraft(id, next);
  };
  const genFollowUp = () => {
    const v = dmVariant + 1;
    setDmVariant(v);
    const next = generateCreatorFollowUpDm(dmInput, v);
    setDraft(next);
    outreach.setDmDraft(id, next);
  };
  const creatorPayload = {
    displayName: creator.displayName,
    username: creator.username,
    biography: creator.biography,
    category: creator.category,
    followersCount: creator.followersCount,
  };
  const brandPayload = dmProduct
    ? {
        productName: dmProduct.name,
        brand: dmProduct.brand,
        category: dmProduct.category,
        usp: dmProduct.usp,
        sellingPoints: dmProduct.sellingPoints,
        target: dmProduct.target,
      }
    : null;

  /**
   * DM 생성 두 갈래를 명확히 분리:
   *  - 'ai'    : AI가 이 셀럽에 맞춰 DM 전체를 새로 작성(/api/ai/dm).
   *  - 'style' : 저장한 '내 DM 스타일' 틀을 쓰고 [[ai:]] 구간만 채움.
   * 상품을 골랐으면 두 경우 모두 {상품}/{브랜드}·문맥에 반영된다.
   */
  const runGen = async (kind: 'ai' | 'style') => {
    if (aiLoading) return;
    setAiLoading(kind);
    setAiError(null);
    const fallback = generateCreatorDm(dmInput, dmVariant);
    const { text, error } =
      kind === 'style'
        ? await generateStyledDm({
            template: dmTemplate,
            creator: creatorPayload,
            brand: brandPayload,
            fallback,
          })
        : await generateAiDm({ creator: creatorPayload, brand: brandPayload, fallback });
    if (error) setAiError(error);
    setDraft(text);
    outreach.setDmDraft(id, text);
    setAiLoading(false);
  };
  const copy = async (open: boolean) => {
    const text = draft ?? '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; still open if requested */
    }
    if (open) window.open(creator.profileUrl, '_blank', 'noopener,noreferrer');
  };

  /**
   * "DM 보내기" — 인스타는 콜드 DM 자동 발송을 막아둬서(약관·계정 정지 위험) 여기까지가
   * 안전한 최대치다: DM을 복사하고, 그 셀럽 DM 창(ig.me 공식 메시지 링크)을 새 탭으로 열고,
   * CRM 상태를 '연락함'으로 표시한다. 사용자는 붙여넣기(Ctrl+V)+엔터만 하면 된다.
   */
  const send = async () => {
    const text = draft ?? '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; still open the DM window */
    }
    outreach.markContacted(id);
    window.open(
      `https://ig.me/m/${encodeURIComponent(creator.username)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      <Link
        href="/discover"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Discover로 돌아가기
      </Link>

      {/* ── Profile ─────────────────────────────────────────────── */}
      <section className="bg-card dark:border-border rounded-2xl border border-slate-200/60 p-6">
        <div className="flex items-start gap-4">
          <Avatar className="size-16">
            {creator.profileImageUrl ? (
              <AvatarImage src={creator.profileImageUrl} alt={creator.displayName} />
            ) : null}
            <AvatarFallback>{creator.displayName.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {creator.displayName}
              </h1>
              {creator.isVerified ? (
                <BadgeCheck className="size-5 shrink-0 text-sky-500" aria-label="인증됨" />
              ) : null}
            </div>
            <p className="text-muted-foreground text-sm">@{creator.username}</p>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="inline-flex items-center gap-1">
                <Instagram className="size-3" />
                {creator.platform}
              </span>
              {creator.category ? <span>· {creator.category}</span> : null}
              <span>· 마지막 발견 {formatDate(updatedAt)}</span>
            </div>
          </div>
          <Button asChild variant="default" className="shrink-0">
            <a href={creator.profileUrl} target="_blank" rel="noopener noreferrer">
              <Instagram className="size-4" />
              Instagram
            </a>
          </Button>
        </div>

        {creator.biography ? (
          <p className="text-foreground/90 mt-4 whitespace-pre-line text-sm leading-relaxed">
            {creator.biography}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-center">
          <Stat label="팔로워" value={creator.followersCount} />
          <Stat label="팔로잉" value={creator.followingCount} />
          <Stat label="게시물" value={creator.postsCount} />
        </div>
      </section>

      {/* ── 상태 + 메모 ─────────────────────────────────────────── */}
      <section className="bg-card dark:border-border mt-6 rounded-2xl border border-slate-200/60 p-6">
        <h2 className="text-sm font-semibold">상태</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CONTACT_STATUS_ORDER.map((s) => {
            const active = record.status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => outreach.setStatus(id, s)}
                aria-pressed={active}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? CONTACT_STATUS_META[s].active
                    : 'text-muted-foreground hover:bg-muted border-transparent',
                )}
              >
                {s}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <h2 className="text-sm font-semibold">메모</h2>
          {noteSaved ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <Check className="size-3" />
              저장됨
            </span>
          ) : null}
        </div>
        <textarea
          value={noteDraft ?? ''}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="이 크리에이터에 대한 내부 메모… (자동 저장)"
          rows={2}
          className="border-input bg-background focus-visible:ring-ring mt-2 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
        />
      </section>

      {/* ── DM ──────────────────────────────────────────────────── */}
      <section className="bg-card dark:border-border mt-6 rounded-2xl border border-slate-200/60 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">DM 초안</h2>
          <span className="text-muted-foreground text-xs">
            {(draft ?? '').length}
            {dmTemplate.trim() ? '자' : '/250'}
          </span>
        </div>

        {/* 어떤 상품으로 DM을 쓸지 — 항상 선택 가능. 안 고르면 상품 없이(협업 제안만)
            생성한다. (예전엔 템플릿 있을 때만 보이고, 기본 첫 상품이 자동으로 들어갔음) */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {products.length > 0 ? (
            <>
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <Sparkles className="text-primary size-3.5" />
                DM에 넣을 상품
              </span>
              <select
                value={dmProductId}
                onChange={(e) => setDmProductId(e.target.value)}
                className="border-input bg-background focus-visible:ring-ring h-8 rounded-lg border px-2 text-xs outline-none focus-visible:ring-2"
              >
                <option value="">상품 없이 (협업 제안만)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || '(이름 없음)'}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          {/* 내 DM 스타일 편집 — 페이지 이동 없이 팝업으로 */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-primary/40 text-primary ml-auto"
            onClick={() => setStyleOpen(true)}
          >
            <Wand2 className="size-4" />
            {dmTemplate.trim() ? '내 DM 스타일 수정' : '내 DM 스타일 만들기'}
          </Button>
        </div>

        <textarea
          value={draft ?? ''}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => outreach.setDmDraft(id, e.target.value)}
          placeholder="아래 '초안 생성'을 눌러 크리에이터 맞춤 DM을 만들어 보세요."
          rows={6}
          className="border-input bg-background focus-visible:ring-ring mt-2 w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Primary — 복사 + DM 창 열기 + 연락함 표시 */}
          <Button type="button" variant="default" onClick={() => void send()}>
            <Send className="size-4" />
            DM 보내기
          </Button>
          {/* 두 갈래 명확히 — AI가 통째로 쓰기 / 내 저장 스타일로 쓰기 */}
          <Button
            type="button"
            variant="outline"
            onClick={() => void runGen('ai')}
            disabled={aiLoading !== false}
          >
            {aiLoading === 'ai' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            AI DM 생성
          </Button>
          {dmTemplate.trim() ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void runGen('style')}
              disabled={aiLoading !== false}
              className="border-primary/40 text-primary"
            >
              {aiLoading === 'style' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              내 스타일 DM
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => copy(false)}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? '복사됨' : '복사'}
          </Button>
          {/* More */}
          <details className="relative">
            <summary className="border-input text-muted-foreground hover:text-foreground inline-flex h-9 cursor-pointer list-none items-center gap-1 rounded-md border px-3 text-sm transition-colors">
              <MoreHorizontal className="size-4" />더 보기
            </summary>
            <div className="bg-card absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border py-1 shadow-lg">
              <button
                type="button"
                onClick={regenDraft}
                className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              >
                <RefreshCw className="size-4" />
                다시 생성
              </button>
              <button
                type="button"
                onClick={() => outreach.markContacted(id)}
                className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              >
                <Send className="size-4" />
                연락 완료로 기록
              </button>
            </div>
          </details>
        </div>
        {aiError ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>{aiError}</span>
          </div>
        ) : null}
        <p className="text-muted-foreground mt-2 text-xs">
          <b className="font-medium">DM 보내기</b>는 DM을 복사하고 그 셀럽의 인스타 DM 창을 열고
          ‘연락함’으로 표시해요 — 붙여넣기(Ctrl/⌘+V) 후 보내면 끝. (인스타 정책상 자동 전송은
          불가해요.)
          <br />
          <b className="font-medium">AI 초안</b>은 이 크리에이터에 맞춰 만듭니다
          {dmTemplate.trim() ? ' (설정의 내 DM 스타일 사용 · AI 구간만 채움)' : ''}. 설정 → DM
          스타일에서 나만의 틀을 저장할 수 있어요.
        </p>
      </section>

      {/* ── 후속관리 ────────────────────────────────────────────── */}
      <section className="bg-card dark:border-border mt-6 rounded-2xl border border-slate-200/60 p-6">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock className="size-4" />
          후속관리
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">최근 연락일</p>
            <p className="mt-0.5 font-medium">{formatDate(record.contactedAt)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">연락 횟수</p>
            <p className="mt-0.5 font-medium">{record.contactCount}회</p>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-muted-foreground text-xs" htmlFor="followup">
            후속 연락 예정일
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id="followup"
              type="date"
              value={record.followUpAt ?? ''}
              onChange={(e) => outreach.setFollowUpAt(id, e.target.value || null)}
              className="border-input bg-background focus-visible:ring-ring rounded-lg border px-3 py-1.5 text-sm outline-none focus-visible:ring-2"
            />
            <Button type="button" variant="outline" onClick={genFollowUp}>
              <RefreshCw className="size-4" />
              후속 DM 생성
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-muted-foreground text-xs">답변 메모</p>
          <textarea
            defaultValue={record.replyNote}
            onBlur={(e) => outreach.setReply(id, e.target.value)}
            placeholder="크리에이터의 답변 내용을 기록하면 상태가 ‘답변옴’으로 바뀝니다."
            rows={2}
            className="border-input bg-background focus-visible:ring-ring mt-1 w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
          />
        </div>
      </section>

      {/* ── Timeline (bottom) ───────────────────────────────────── */}
      <Timeline
        discoveredAt={updatedAt}
        contactedAt={record.contactedAt}
        followUpAt={record.followUpAt}
        replyStatus={record.replyStatus}
        status={record.status}
      />
      <DmStyleDialog open={styleOpen} onClose={() => setStyleOpen(false)} />
    </div>
  );
}

function Timeline({
  discoveredAt,
  contactedAt,
  followUpAt,
  replyStatus,
  status,
}: {
  discoveredAt: string | null;
  contactedAt: string | null;
  followUpAt: string | null;
  replyStatus: string | null;
  status: string;
}) {
  const events: { label: string; when: string }[] = [];
  if (discoveredAt) events.push({ label: '검색·발견', when: formatDate(discoveredAt) });
  if (contactedAt) events.push({ label: 'DM 전송', when: formatDate(contactedAt) });
  if (replyStatus === '답변옴') events.push({ label: '답변 받음', when: '' });
  if (followUpAt) events.push({ label: '후속 연락 예정', when: followUpAt });
  events.push({ label: `현재 상태 · ${status}`, when: '' });

  return (
    <section className="bg-card dark:border-border mt-6 rounded-2xl border border-slate-200/60 p-6">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <History className="size-4" />
        타임라인
      </h2>
      <ol className="mt-4">
        {events.map((e, i) => (
          <li key={`${e.label}-${i}`} className="flex gap-3 pb-4 last:pb-0">
            <div className="flex flex-col items-center">
              <span className="bg-primary mt-1 size-2 shrink-0 rounded-full" />
              {i < events.length - 1 ? <span className="bg-border w-px flex-1" /> : null}
            </div>
            <div className="-mt-0.5 flex-1">
              <p className="text-sm font-medium">{e.label}</p>
              {e.when ? <p className="text-muted-foreground text-xs">{e.when}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-lg font-semibold">{value != null ? formatCompactNumber(value) : '—'}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <Link
        href="/discover"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Discover로 돌아가기
      </Link>
      <p className="text-muted-foreground text-sm">{children}</p>
    </div>
  );
}
