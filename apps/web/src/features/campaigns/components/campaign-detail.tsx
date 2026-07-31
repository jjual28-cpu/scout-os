'use client';

import {
  ArrowLeft,
  ArrowUpDown,
  Copy,
  EyeOff,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Star,
  Tag,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { DiscoverCard } from '@/features/search/components/discover-card';
import { isDefaultHidden } from '@/features/search/creator-status';
import { toStage } from '@/features/search/crm-stages';
import { type DiscoverOpportunity } from '@/features/search/discover-mock';
import { useInboxReplyMap, replyKey } from '@/features/search/hooks/use-inbox-reply-map';
import { useOutreach } from '@/features/search/hooks/use-outreach';
import { toDiscoverOpportunity, type InstagramCreator } from '@/features/search/instagram';

import { stashCampaignDraft } from '../draft';
import { useCampaign } from '../hooks/use-campaign';
import { CampaignLabelSelect } from './campaign-label-select';
import { type CampaignResult } from '../types';

/** CampaignResult → DiscoverOpportunity via the same mapper the live search uses. */
function snapshotToOpportunity(s: CampaignResult): DiscoverOpportunity {
  const creator: InstagramCreator = {
    id: s.externalId,
    platform: 'instagram',
    username: s.username,
    displayName: s.displayName,
    profileUrl: s.profileUrl,
    profileImageUrl: s.profileImageUrl,
    biography: s.biography,
    followersCount: s.followersCount,
    followingCount: s.followingCount,
    postsCount: s.postsCount,
    isVerified: s.isVerified,
    category: s.category,
    rawData: null,
  };
  return toDiscoverOpportunity(creator);
}

type SortKey = 'rank' | 'followers' | 'posts';

function Kpi({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  /** 있으면 클릭해 그 리스트로 이동(저장·DM·답변·협업 등). */
  href?: string;
}) {
  const inner = (
    <>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn('mt-0.5 text-2xl font-semibold tabular-nums', accent && 'text-primary')}>
        {value}
      </span>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="bg-card hover:border-primary/50 hover:bg-primary/5 flex flex-col rounded-xl border px-4 py-3 transition-colors"
      >
        {inner}
      </Link>
    );
  }
  return <div className="bg-card flex flex-col rounded-xl border px-4 py-3">{inner}</div>;
}

const FIELD =
  'border-input bg-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2';

function Field({
  label,
  value,
  placeholder,
  onSave,
  textarea,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onSave: (next: string | null) => void;
  textarea?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const commit = () => {
    const next = draft.trim() === '' ? null : draft.trim();
    if (next !== (value ?? null)) onSave(next);
  };
  return (
    <label className="block">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {textarea ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          placeholder={placeholder}
          rows={3}
          className={cn(FIELD, 'mt-1 resize-none')}
        />
      ) : (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          placeholder={placeholder}
          className={cn(FIELD, 'mt-1')}
        />
      )}
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="dark:text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </h2>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="dark:border-border inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 px-2.5 py-1">
      <span className="dark:text-muted-foreground text-slate-400">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

export function CampaignDetail({ id }: { id: string }) {
  const router = useRouter();
  const c = useCampaign(id);
  const outreach = useOutreach();
  const { map: replyMap } = useInboxReplyMap();

  const [sort, setSort] = useState<SortKey>('rank');
  // 기본으로 전부 보인다 — 연락완료 등으로 셀럽이 조용히 사라지면 오히려 헷갈린다는
  // 피드백. 필요하면 토글로 숨길 수 있다.
  const [showHidden, setShowHidden] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // DM History — this campaign's creators that have any outreach activity, newest-contacted first.
  const dmHistory = useMemo(() => {
    return c.results
      .map((r) => ({ r, rec: outreach.records[r.externalId] }))
      .filter(({ rec }) => {
        if (!rec) return false;
        const stg = toStage(rec.status);
        return Boolean(
          rec.contactedAt ||
          rec.dmDraft?.trim() ||
          rec.replyStatus ||
          stg === '연락 준비' ||
          stg === '연락 완료' ||
          stg === '답변' ||
          stg === '협업',
        );
      })
      .sort((a, b) => (b.rec?.contactedAt ?? '').localeCompare(a.rec?.contactedAt ?? ''));
  }, [c.results, outreach.records]);

  const hiddenCount = useMemo(
    () => c.results.filter((r) => isDefaultHidden(outreach.records[r.externalId]?.status)).length,
    [c.results, outreach.records],
  );

  const visible = useMemo(() => {
    const filtered = c.results.filter(
      (r) => showHidden || !isDefaultHidden(outreach.records[r.externalId]?.status),
    );
    const arr = [...filtered];
    if (sort === 'followers') arr.sort((a, b) => (b.followersCount ?? 0) - (a.followersCount ?? 0));
    else if (sort === 'posts') arr.sort((a, b) => (b.postsCount ?? 0) - (a.postsCount ?? 0));
    return arr;
  }, [c.results, showHidden, sort, outreach.records]);

  const research = () => {
    if (!c.campaign) return;
    stashCampaignDraft({
      title: c.campaign.title,
      query: c.campaign.query,
      brand: c.campaign.brand,
      season: c.campaign.season,
      goal: c.campaign.goal,
      memo: c.campaign.memo,
      label: c.campaign.label,
      productId: c.campaign.productId,
      autoRun: true,
    });
    router.push('/discover');
  };

  const duplicate = () => {
    if (!c.campaign) return;
    stashCampaignDraft({
      title: `${c.campaign.title} (복사본)`,
      query: c.campaign.query,
      brand: c.campaign.brand,
      season: c.campaign.season,
      goal: c.campaign.goal,
      memo: c.campaign.memo,
      label: c.campaign.label,
      productId: c.campaign.productId,
      autoRun: false,
    });
    router.push('/discover');
  };

  const doDelete = async () => {
    setConfirmDelete(false);
    const ok = await c.remove();
    if (ok) router.push('/campaigns');
  };

  if (c.status === 'loading') {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="mt-4 h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (c.status === 'unavailable' || c.status === 'notfound' || !c.campaign) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
        <p className="text-muted-foreground text-sm">
          {c.status === 'notfound'
            ? '이 캠페인을 찾을 수 없어요.'
            : '캠페인은 로그인 후 실제 데이터가 연결된 환경에서만 볼 수 있어요.'}
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/campaigns">
            <ArrowLeft className="size-4" />
            캠페인으로
          </Link>
        </Button>
      </div>
    );
  }

  const campaign = c.campaign;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <Link
        href="/campaigns"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        캠페인
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{campaign.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            검색어 “{campaign.query}” · {campaign.platform}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CampaignLabelSelect value={campaign.label} onChange={(l) => void c.setLabel(l)} />
          <Button
            variant={campaign.favorite ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => void c.toggleFavorite()}
            aria-pressed={campaign.favorite}
            aria-label="즐겨찾기"
          >
            <Star className={cn('size-4', campaign.favorite && 'fill-amber-500 text-amber-500')} />
          </Button>
          {/* Opens this campaign in Discover — restores results, never re-searches. */}
          <Button asChild variant="outline">
            <Link href={`/discover?campaign=${campaign.id}`}>결과 보기</Link>
          </Button>
          <Button variant="outline" onClick={research}>
            <RefreshCw className="size-4" />
            다시 검색
          </Button>
          <Button variant="outline" onClick={duplicate}>
            <Copy className="size-4" />
            복제
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDelete(true)}
            aria-label="삭제"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6">
        <SectionLabel>Summary</SectionLabel>
        {campaign.status === 'failed' ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border p-4 text-sm">
            이 검색은 실패했어요: {campaign.error ?? '알 수 없는 오류'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Kpi label="검색" value={c.summary.discovered} accent />
            <Kpi label="저장" value={c.summary.saved} href="/crm" />
            <Kpi label="DM" value={c.summary.dm} href="/crm" />
            <Kpi label="답변" value={c.summary.reply} href="/inbox" />
            <Kpi label="협업" value={c.summary.collab} href="/crm" />
            <Kpi label="전환율" value={`${c.summary.conversion}%`} />
          </div>
        )}
        {c.productName || campaign.brand || campaign.season || campaign.goal ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {c.productName ? <MetaChip label="상품" value={c.productName} /> : null}
            {campaign.brand ? <MetaChip label="브랜드" value={campaign.brand} /> : null}
            {campaign.season ? <MetaChip label="시즌" value={campaign.season} /> : null}
            {campaign.goal ? <MetaChip label="목표" value={campaign.goal} /> : null}
          </div>
        ) : null}
      </div>

      {/* Creators */}
      <div className="mt-10">
        <SectionLabel>셀럽 ({c.results.length})</SectionLabel>
      </div>

      {/* Controls */}
      <div className="dark:border-border mb-5 flex flex-wrap items-center gap-2 border-b border-slate-200/60 pb-4">
        <p className="text-muted-foreground text-sm">
          크리에이터 <span className="text-foreground font-medium">{visible.length}명</span>
          {visible.length !== c.results.length ? ` / ${c.results.length}명` : ''}
        </p>
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            aria-pressed={showHidden}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              showHidden
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <EyeOff className="size-3.5" />
            {showHidden ? `숨김 ${hiddenCount}명 포함 중` : `숨김 포함 보기 (${hiddenCount})`}
          </button>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          <ArrowUpDown className="text-muted-foreground size-3.5" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="border-input bg-background focus-visible:ring-ring rounded-lg border px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2"
          >
            <option value="rank">검색 순서</option>
            <option value="followers">팔로워순</option>
            <option value="posts">게시물순</option>
          </select>
        </div>
      </div>

      {c.results.length === 0 ? (
        <div className="text-muted-foreground py-16 text-center text-sm">
          이 캠페인에서는 크리에이터를 찾지 못했어요.
        </div>
      ) : visible.length === 0 ? (
        <div className="text-muted-foreground py-16 text-center text-sm">
          조건에 맞는 크리에이터가 없어요. “숨김 포함 보기”를 켜보세요.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => (
            <DiscoverCard
              key={r.externalId}
              item={snapshotToOpportunity(r)}
              keyword={campaign.query}
            />
          ))}
        </div>
      )}

      {/* DM History */}
      <div className="mt-10">
        <SectionLabel>DM 히스토리</SectionLabel>
        {dmHistory.length === 0 ? (
          <p className="dark:border-border dark:text-muted-foreground rounded-xl border border-slate-200/60 py-8 text-center text-sm text-slate-400">
            아직 연락한 셀럽이 없어요. 셀럽 카드에서 DM을 준비해보세요.
          </p>
        ) : (
          <div className="dark:border-border overflow-hidden rounded-xl border border-slate-200/60">
            <ul className="dark:divide-border/60 divide-y divide-slate-100">
              {dmHistory.map(({ r, rec }) => {
                const stg = toStage(rec!.status);
                const reply = replyMap.get(replyKey(r.externalId));
                const preview = reply?.text || rec!.replyNote || '';
                return (
                  <li key={r.externalId}>
                    <Link
                      href={`/creators/${encodeURIComponent(r.externalId)}`}
                      className="dark:hover:bg-muted/40 flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">@{r.username}</p>
                        <p className="dark:text-muted-foreground truncate text-xs text-slate-500">
                          {rec!.contactedAt
                            ? `연락 ${new Date(rec!.contactedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}`
                            : 'DM 준비됨'}
                          {preview ? ` · ${preview.slice(0, 30)}` : ''}
                        </p>
                        {rec!.tags.length > 0 ? (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {rec!.tags.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="bg-primary/10 text-primary inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              >
                                <Tag className="size-2.5" />
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {reply ? (
                          <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
                            <MessageSquareText className="size-3" />
                            답장{reply.unread > 0 ? ` · 새 ${reply.unread}` : ''}
                          </span>
                        ) : null}
                        <span className="dark:bg-muted dark:text-muted-foreground rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {stg}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Memo & 정보 */}
      <div className="mt-10">
        <SectionLabel>메모 &amp; 정보</SectionLabel>
        <div className="dark:border-border grid gap-4 rounded-xl border border-slate-200/60 p-5 sm:grid-cols-2">
          <Field
            label="제목"
            value={campaign.title}
            placeholder="캠페인 제목"
            onSave={(v) => void c.updateMeta({ title: v ?? campaign.query })}
          />
          <label className="block">
            <span className="text-muted-foreground text-xs font-medium">상품</span>
            <select
              value={campaign.productId ?? ''}
              onChange={(e) => void c.updateMeta({ productId: e.target.value || null })}
              className={cn(FIELD, 'mt-1')}
            >
              <option value="">연결 안 함</option>
              {c.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="브랜드"
            value={campaign.brand}
            placeholder="예: FANDEAL"
            onSave={(v) => void c.updateMeta({ brand: v })}
          />
          <Field
            label="시즌"
            value={campaign.season}
            placeholder="예: 여름"
            onSave={(v) => void c.updateMeta({ season: v })}
          />
          <Field
            label="목표"
            value={campaign.goal}
            placeholder="예: 30명 연락"
            onSave={(v) => void c.updateMeta({ goal: v })}
          />
          <div className="hidden sm:block" />
          <div className="sm:col-span-2">
            <Field
              label="메모"
              value={campaign.memo}
              placeholder="예: 릴스 위주 공략"
              onSave={(v) => void c.updateMeta({ memo: v })}
              textarea
            />
          </div>
        </div>
      </div>

      {/* AI Insight */}
      <div className="mt-10">
        <SectionLabel>AI Insight</SectionLabel>
        <div className="dark:border-border flex items-start gap-3.5 rounded-xl border border-slate-200/60 p-5">
          <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
            <Sparkles className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">캠페인 성과 AI 분석</p>
              <span className="dark:bg-muted dark:text-muted-foreground rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                준비 중
              </span>
            </div>
            <p className="dark:text-muted-foreground mt-1 text-sm text-slate-500">
              AI가 이 캠페인의 셀럽 적합도와 다음 액션을 제안할 예정입니다.
            </p>
          </div>
        </div>
      </div>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setConfirmDelete(false)}
            aria-hidden
          />
          <div className="bg-card relative w-full max-w-md rounded-2xl border p-5 shadow-2xl">
            <h2 className="text-base font-semibold">정말 이 캠페인을 삭제하시겠습니까?</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              이 캠페인의 검색 결과는 삭제됩니다.
              <br />
              저장한 크리에이터, CRM 상태, DM 초안, 연락 및 협업 기록은 삭제되지 않습니다.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                취소
              </Button>
              <Button variant="destructive" onClick={() => void doDelete()}>
                삭제
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
