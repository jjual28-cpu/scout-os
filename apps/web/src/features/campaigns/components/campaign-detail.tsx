'use client';

import { ArrowLeft, ArrowUpDown, Copy, EyeOff, RefreshCw, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { DiscoverCard } from '@/features/search/components/discover-card';
import { isDefaultHidden } from '@/features/search/creator-status';
import { type DiscoverOpportunity } from '@/features/search/discover-mock';
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
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="bg-card flex flex-col rounded-xl border px-4 py-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn('mt-0.5 text-2xl font-semibold tabular-nums', accent && 'text-primary')}>
        {value}
      </span>
    </div>
  );
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

export function CampaignDetail({ id }: { id: string }) {
  const router = useRouter();
  const c = useCampaign(id);
  const outreach = useOutreach();

  const [sort, setSort] = useState<SortKey>('rank');
  const [showHidden, setShowHidden] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
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

      {campaign.status === 'failed' ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-5 rounded-xl border p-4 text-sm">
          이 검색은 실패했어요: {campaign.error ?? '알 수 없는 오류'}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Kpi label="검색" value={c.summary.discovered} accent />
          <Kpi label="저장" value={c.summary.saved} />
          <Kpi label="DM" value={c.summary.dm} />
          <Kpi label="답변" value={c.summary.reply} />
          <Kpi label="협업" value={c.summary.collab} />
          <Kpi label="전환율" value={`${c.summary.conversion}%`} />
        </div>
      )}

      {/* Campaign 정보 */}
      <div className="bg-card mt-6 grid gap-4 rounded-2xl border p-5 sm:grid-cols-2">
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

      {/* Controls */}
      <div className="mb-5 mt-6 flex flex-wrap items-center gap-2 border-b pb-4">
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
