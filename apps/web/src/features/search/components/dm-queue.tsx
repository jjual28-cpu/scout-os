'use client';

import {
  Check,
  Loader2,
  Package,
  RotateCcw,
  Send,
  SkipForward,
  Sparkles,
  Tag,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/layout/blocks';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts } from '@/features/products/hooks/use-products';
import { cn, formatCompactNumber } from '@/lib/utils';

import { generateCreatorDm } from '../creator-dm';
import { generateAiDm, generateStyledDm, type DmBrand, type DmCreator } from '../dm-generate';
import { useDmTemplate } from '../hooks/use-dm-template';
import { useOutreach } from '../hooks/use-outreach';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';
import { type SavedOpportunity, type SearchResultType } from '../types';
import { DmStyleDialog } from './dm-style-dialog';
import { TYPE_META } from './opportunity-body';

/** 셀럽 유형(카테고리) 칩 — discover/saved 카드와 같은 아이콘·색. */
function CategoryChip({ type }: { type: SearchResultType }) {
  const meta = TYPE_META[type];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
        meta.chip,
      )}
    >
      <Icon className="size-3" />
      {type}
    </span>
  );
}

function handleOf(s: SavedOpportunity): string {
  return s.handle ?? s.id.split(':')[1] ?? s.id;
}
function creatorOf(s: SavedOpportunity): DmCreator {
  return {
    displayName: s.name,
    username: handleOf(s),
    biography: s.reason ?? null,
    category: s.type ?? null,
    followersCount: s.followersCount ?? null,
  };
}

/**
 * "DM 발송 큐" — 연락 안 한 셀럽을 한 명씩 넘기며 빠르게 DM을 보낸다.
 * 인스타는 콜드 DM 자동 발송을 막아서(계정 정지 위험) 여기까지가 안전한 최대치:
 * 초안 복사 → 그 셀럽 DM 창 열기 → '연락완료' 표시 → 자동으로 다음 셀럽.
 * 사용자는 인스타 창에서 붙여넣기(Ctrl/⌘+V)+엔터만 하면 된다.
 */
export function DmQueue() {
  const { saved, hydrated } = useSavedOpportunities();
  const outreach = useOutreach();
  const { template } = useDmTemplate();
  const { products } = useProducts();

  const searchParams = useSearchParams();
  // 'followup' = 후속 예정일이 된 셀럽에게 다시 연락(재연락) / 그 외 = 아직 연락 안 한 신규.
  const mode = searchParams.get('mode') === 'followup' ? 'followup' : 'new';
  const focusId = searchParams.get('focus');
  const today = new Date().toISOString().slice(0, 10);

  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [dmProductId, setDmProductId] = useState('');
  const [styleOpen, setStyleOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [genKind, setGenKind] = useState<'ai' | 'style' | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [copied, setCopied] = useState(false);
  // 이번 세션에 보낸 수(진행률·모멘텀 표시용). 모드 전환 시 리셋.
  const [sentCount, setSentCount] = useState(0);

  const dmProduct = products.find((p) => p.id === dmProductId) ?? null;
  const brand: DmBrand = dmProduct
    ? {
        productName: dmProduct.name,
        brand: dmProduct.brand,
        category: dmProduct.category,
        usp: dmProduct.usp,
        sellingPoints: dmProduct.sellingPoints,
        target: dmProduct.target,
      }
    : null;

  // 큐 대상: 제외·건너뛴 셀럽은 항상 빼고, 모드에 따라
  //  - 신규:  아직 연락 안 한 셀럽
  //  - 재연락: 연락했고 후속 예정일이 오늘/지났고 아직 답변이 없는(연락완료) 셀럽
  const remaining = useMemo(() => {
    const list = saved.filter((s) => {
      const r = outreach.records[s.id];
      if (r?.status === '제외') return false;
      if (skipped.has(s.id)) return false;
      if (mode === 'followup') {
        return (
          Boolean(r?.contactedAt) &&
          r?.status === '연락완료' &&
          Boolean(r?.followUpAt) &&
          r!.followUpAt! <= today
        );
      }
      if (r?.contactedAt) return false;
      return true;
    });
    // CRM '재연락' 버튼으로 특정 셀럽을 지정해 왔으면 그 사람을 맨 앞으로.
    if (focusId) {
      const i = list.findIndex((s) => s.id === focusId);
      if (i > 0) list.unshift(list.splice(i, 1)[0]!);
    }
    return list;
  }, [saved, outreach.records, skipped, mode, focusId, today]);
  const current = remaining[0] ?? null;

  // 신규/재연락 토글에 보여줄 건수.
  const newCount = useMemo(
    () =>
      saved.filter((s) => {
        const r = outreach.records[s.id];
        return r?.status !== '제외' && !r?.contactedAt;
      }).length,
    [saved, outreach.records],
  );
  const followupCount = useMemo(
    () =>
      saved.filter((s) => {
        const r = outreach.records[s.id];
        return r?.status === '연락완료' && Boolean(r?.followUpAt) && r!.followUpAt! <= today;
      }).length,
    [saved, outreach.records, today],
  );

  useEffect(() => {
    setDraft(current ? (outreach.get(current.id).dmDraft ?? '') : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // 신규↔재연락 전환하면 이번 세션 카운터를 새로 시작.
  useEffect(() => {
    setSentCount(0);
  }, [mode]);

  const fallbackFor = (s: SavedOpportunity) =>
    generateCreatorDm(
      {
        displayName: s.name,
        username: handleOf(s),
        biography: s.reason ?? '',
        category: s.type ?? '',
        followersCount: s.followersCount ?? null,
        reason: s.reason ?? '',
      },
      1,
    );

  const gen = async (kind: 'ai' | 'style') => {
    if (!current || genKind) return;
    setGenKind(kind);
    try {
      const fallback = fallbackFor(current);
      const { text } =
        kind === 'style'
          ? await generateStyledDm({ template, creator: creatorOf(current), brand, fallback })
          : await generateAiDm({ creator: creatorOf(current), brand, fallback });
      setDraft(text);
      outreach.setDmDraft(current.id, text);
    } finally {
      setGenKind(null);
    }
  };

  /** 남은 셀럽 중 초안 없는 이들에게 미리 초안을 만들어둔다(발송 때 기다림 0). */
  const bulkGenerate = async () => {
    if (bulk) return;
    const targets = remaining.filter((s) => !outreach.get(s.id).dmDraft?.trim());
    if (targets.length === 0) return;
    setBulk({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      const s = targets[i]!;
      const fallback = fallbackFor(s);
      const { text } = template.trim()
        ? await generateStyledDm({ template, creator: creatorOf(s), brand, fallback })
        : await generateAiDm({ creator: creatorOf(s), brand, fallback });
      outreach.setDmDraft(s.id, text);
      if (s.id === current?.id) setDraft(text);
      setBulk({ done: i + 1, total: targets.length });
    }
    setBulk(null);
  };

  const send = async () => {
    if (!current) return;
    const text = draft.trim() || fallbackFor(current);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked — the DM window still opens */
    }
    outreach.markContacted(current.id); // contactedAt 세팅 → 큐에서 빠지고 다음 셀럽으로
    setSentCount((n) => n + 1);
    window.open(
      `https://ig.me/m/${encodeURIComponent(handleOf(current))}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const skip = () => {
    if (current) setSkipped((prev) => new Set(prev).add(current.id));
  };

  const noDraftTargets = useMemo(
    () => remaining.filter((s) => !outreach.records[s.id]?.dmDraft?.trim()).length,
    [remaining, outreach.records],
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title={mode === 'followup' ? '재연락' : 'DM 발송'}
        description={
          mode === 'followup'
            ? '후속 예정일이 된 셀럽에게 다시 연락해요. 보내면 다음 후속일이 자동으로 새로 잡혀요.'
            : '연락할 셀럽을 한 명씩 넘기며 빠르게 보내요. 인스타 창이 열리면 붙여넣기(Ctrl/⌘+V) + 엔터만 하면 끝.'
        }
      />

      {/* 신규 / 재연락 전환 */}
      <div className="border-input mb-5 mt-4 inline-flex rounded-lg border p-0.5 text-sm">
        <Link
          href="/dm-queue"
          className={cn(
            'rounded-md px-3 py-1 transition-colors',
            mode === 'new' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          신규{newCount > 0 ? ` (${newCount})` : ''}
        </Link>
        <Link
          href="/dm-queue?mode=followup"
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-3 py-1 transition-colors',
            mode === 'followup'
              ? 'bg-primary text-primary-foreground'
              : followupCount > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground',
          )}
        >
          <RotateCcw className="size-3.5" />
          재연락{followupCount > 0 ? ` (${followupCount})` : ''}
        </Link>
      </div>

      {/* 옵션 바 — 상품 · 스타일 · 미리 초안 */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {products.length > 0 ? (
          <div className="inline-flex items-center gap-1.5">
            <Package className="text-muted-foreground size-4" />
            <select
              value={dmProductId}
              onChange={(e) => setDmProductId(e.target.value)}
              className="border-input bg-background focus-visible:ring-ring h-8 rounded-lg border px-2 text-xs outline-none focus-visible:ring-2"
            >
              <option value="">상품 없이</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || '(이름 없음)'}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-primary/40 text-primary"
          onClick={() => setStyleOpen(true)}
        >
          <Wand2 className="size-3.5" />
          {template.trim() ? '내 DM 스타일 수정' : '내 DM 스타일 만들기'}
        </Button>
        {noDraftTargets > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => void bulkGenerate()}
            disabled={Boolean(bulk)}
          >
            {bulk ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {bulk
              ? `초안 만드는 중… ${bulk.done}/${bulk.total}`
              : `초안 미리 만들기 (${noDraftTargets})`}
          </Button>
        ) : null}
      </div>

      {!hydrated ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : !current ? (
        <EmptyState
          className="min-h-[320px] justify-center"
          icon={<Check className="size-5" />}
          title={
            skipped.size > 0
              ? '남은 셀럽을 다 처리했어요'
              : mode === 'followup'
                ? '재연락할 셀럽이 없어요'
                : '보낼 셀럽이 없어요'
          }
          description={
            mode === 'followup'
              ? "후속 예정일이 된 셀럽이 여기 모여요. CRM의 '후속 필요' 카드에서 넘어와요."
              : '셀럽 찾기에서 저장하면 여기 발송 큐에 쌓여요.'
          }
          action={
            skipped.size > 0 ? (
              <Button type="button" variant="outline" onClick={() => setSkipped(new Set())}>
                건너뛴 {skipped.size}명 다시 보기
              </Button>
            ) : (
              <Button asChild>
                <Link href={mode === 'followup' ? '/crm' : '/discover'}>
                  {mode === 'followup' ? 'CRM에서 후속 확인' : '셀럽 찾으러 가기'}
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="mb-3">
            <div className="text-muted-foreground flex items-center justify-between text-sm">
              <span>
                {mode === 'followup' ? '재연락할 셀럽 ' : '보낼 셀럽 '}
                <span className="text-foreground font-semibold">{remaining.length}명</span> 남음
                {sentCount > 0 ? (
                  <span className="text-primary ml-1.5 font-medium">
                    · 이번 세션 {sentCount}명 보냄
                  </span>
                ) : null}
              </span>
              {skipped.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setSkipped(new Set())}
                  className="text-primary text-xs hover:underline"
                >
                  건너뛴 {skipped.size}명 다시 보기
                </button>
              ) : null}
            </div>
            {sentCount > 0 ? (
              <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${(sentCount / (sentCount + remaining.length)) * 100}%` }}
                />
              </div>
            ) : null}
          </div>

          <div className="bg-card dark:border-border rounded-2xl border border-slate-200/60 p-6">
            {/* 셀럽 */}
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                {current.profileImageUrl ? (
                  <AvatarImage src={current.profileImageUrl} alt={current.name} />
                ) : null}
                <AvatarFallback>{current.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <a
                  href={`https://www.instagram.com/${handleOf(current)}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-semibold hover:underline"
                >
                  {current.name}
                </a>
                <p className="text-muted-foreground truncate text-sm">
                  @{handleOf(current)}
                  {current.followersCount != null
                    ? ` · 팔로워 ${formatCompactNumber(current.followersCount)}`
                    : ''}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <CategoryChip type={current.type} />
                  {outreach.get(current.id).tags.map((t) => (
                    <span
                      key={t}
                      className="bg-primary/10 text-primary inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                    >
                      <Tag className="size-2.5" />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* DM 초안 */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center gap-2">
                <p className="text-muted-foreground text-xs font-medium">DM 초안</p>
                <div className="ml-auto flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => void gen('ai')}
                    disabled={genKind !== null}
                  >
                    {genKind === 'ai' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    AI DM
                  </Button>
                  {template.trim() ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-primary/40 text-primary h-7 px-2"
                      onClick={() => void gen('style')}
                      disabled={genKind !== null}
                    >
                      {genKind === 'style' ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="size-3.5" />
                      )}
                      내 스타일
                    </Button>
                  ) : null}
                </div>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={(e) => outreach.setDmDraft(current.id, e.target.value)}
                onKeyDown={(e) => {
                  // ⌘/Ctrl+Enter = 바로 보내기 (한 명씩 빠르게 넘길 때).
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={9}
                placeholder="'AI DM' 또는 '내 스타일'로 초안을 만들거나 직접 쓰세요."
                className="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2"
              />
            </div>

            {/* 액션 */}
            <div className="mt-4 flex items-center gap-2">
              <Button type="button" className="flex-1" onClick={() => void send()}>
                {copied ? <Check className="size-4" /> : <Send className="size-4" />}
                보내기 (복사 + DM창 열기)
                <kbd className="bg-primary-foreground/20 ml-1.5 hidden rounded px-1.5 py-0.5 font-sans text-[10px] font-medium sm:inline">
                  ⌘↵
                </kbd>
              </Button>
              <Button type="button" variant="outline" onClick={skip}>
                <SkipForward className="size-4" />
                건너뛰기
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-snug">
              ‘보내기’ → 초안 복사 + 이 셀럽 인스타 DM창 열림 + 연락완료 표시 + 다음 셀럽으로.
              인스타 창에서 <b className="font-medium">붙여넣기(Ctrl/⌘+V) + 엔터</b>만 하면 끝.
              (인스타 정책상 자동 전송은 불가해요.)
            </p>
          </div>
        </>
      )}

      <DmStyleDialog open={styleOpen} onClose={() => setStyleOpen(false)} />
    </div>
  );
}
