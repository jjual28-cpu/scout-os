'use client';

import {
  AlertCircle,
  CalendarClock,
  Instagram,
  MoreHorizontal,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCompactNumber } from '@/lib/utils';

import { STAGE_META, STAGE_ORDER, stageStored, toStage, type Stage } from '../crm-stages';
import { useOutreach } from '../hooks/use-outreach';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';
import { CreatorDrawer, type BoardCard } from './creator-drawer';

function username(id: string): string {
  return id.split(':')[1] ?? id;
}

export function CrmBoard() {
  const saved = useSavedOpportunities();
  const outreach = useOutreach();

  const [text, setText] = useState('');
  const [platform, setPlatform] = useState('all');
  const [onlyFollowUp, setOnlyFollowUp] = useState(false);
  const [onlyReplied, setOnlyReplied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<BoardCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrated = saved.hydrated && outreach.hydrated;

  const cards: BoardCard[] = useMemo(() => {
    const map = new Map<string, BoardCard>();
    for (const s of saved.saved) {
      const rec = outreach.records[s.id];
      const handle = s.handle ?? username(s.id);
      map.set(s.id, {
        id: s.id,
        name: s.name,
        username: handle,
        platform: s.platform,
        followersCount: s.followersCount ?? null,
        profileImageUrl: s.profileImageUrl ?? null,
        profileUrl: `https://www.instagram.com/${handle}/`,
        tag: s.type,
        bio: s.reason ?? '',
        stage: rec ? toStage(rec.status) : '저장',
        contactedAt: rec?.contactedAt ?? null,
        followUpAt: rec?.followUpAt ?? null,
        note: rec?.note || s.note || '',
        replyStatus: rec?.replyStatus ?? null,
      });
    }
    for (const rec of Object.values(outreach.records)) {
      if (map.has(rec.creatorId)) continue;
      const u = username(rec.creatorId);
      map.set(rec.creatorId, {
        id: rec.creatorId,
        name: u,
        username: u,
        platform: 'instagram',
        followersCount: null,
        profileImageUrl: null,
        profileUrl: `https://www.instagram.com/${u}/`,
        tag: '',
        bio: '',
        stage: toStage(rec.status),
        contactedAt: rec.contactedAt,
        followUpAt: rec.followUpAt,
        note: rec.note,
        replyStatus: rec.replyStatus,
      });
    }
    return [...map.values()];
  }, [saved.saved, outreach.records]);

  const visible = useMemo(
    () =>
      cards.filter((c) => {
        const q = text.trim().toLowerCase();
        if (q && !`${c.name} @${c.username}`.toLowerCase().includes(q)) return false;
        if (platform !== 'all' && c.platform !== platform) return false;
        if (onlyFollowUp && !c.followUpAt) return false;
        if (onlyReplied && c.stage !== '답변') return false;
        return true;
      }),
    [cards, text, platform, onlyFollowUp, onlyReplied],
  );

  const byStage = useMemo(() => {
    const m: Record<Stage, BoardCard[]> = {
      발견: [],
      검토: [],
      저장: [],
      '연락 준비': [],
      '연락 완료': [],
      답변: [],
      협업: [],
      제외: [],
    };
    for (const c of visible) m[c.stage].push(c);
    return m;
  }, [visible]);

  async function move(id: string, stage: Stage) {
    const ok = await outreach.setStageSafe(id, stageStored(stage));
    if (!ok) setError('상태 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
  }
  async function bulkMove(stage: Stage) {
    let failed = false;
    for (const id of selected) {
      const ok = await outreach.setStageSafe(id, stageStored(stage));
      if (!ok) failed = true;
    }
    setSelected(new Set());
    if (failed) setError('일부 항목 저장에 실패했어요. 다시 시도해 주세요.');
  }
  /** 선택한 셀럽을 CRM(저장 목록)에서 완전히 삭제. 되돌릴 수 없어 확인 후 실행. */
  function bulkDelete() {
    const n = selected.size;
    if (n === 0) return;
    if (!window.confirm(`선택한 ${n}명을 삭제할까요? 저장 목록에서 완전히 지워집니다.`)) return;
    // 저장 목록 + 연락 기록 둘 다 지워야 카드가 사라진다(연락 기록만 있어도 카드가 생김).
    for (const id of selected) {
      saved.remove(id);
      outreach.removeRecord(id);
    }
    setSelected(new Set());
  }
  const toggleSelect = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  /** 컬럼 전체선택 토글 — 그 단계 카드가 모두 선택돼 있으면 해제, 아니면 전부 선택. */
  const toggleSelectStage = (ids: string[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = ids.length > 0 && ids.every((id) => next.has(id));
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="px-4 pt-6 sm:px-8">
        <PageHeader title="CRM" description="셀럽을 발견부터 협업까지 단계별로 관리합니다." />
      </div>

      {/* Toolbar */}
      <div className="dark:border-border border-b border-slate-200/60 px-4 py-3 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="이름 또는 @username 검색"
              className="border-input bg-background focus-visible:ring-ring h-9 w-56 rounded-lg border pl-8 pr-3 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
          >
            <option value="all">모든 플랫폼</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="blog">Blog</option>
          </select>
          <FilterToggle active={onlyFollowUp} onClick={() => setOnlyFollowUp((v) => !v)}>
            후속 예정
          </FilterToggle>
          <FilterToggle active={onlyReplied} onClick={() => setOnlyReplied((v) => !v)}>
            답변 있음
          </FilterToggle>
          <select
            disabled
            className="border-input bg-background text-muted-foreground h-9 cursor-not-allowed rounded-lg border px-2.5 text-sm opacity-60"
            title="담당자 기능은 곧 지원됩니다"
          >
            <option>담당자 · 전체</option>
          </select>
          <span className="text-muted-foreground ml-auto text-sm">{visible.length}명</span>
        </div>
      </div>

      {/* Bulk action bar — 선택 시 상단에 바로 노출(잘 보이게) */}
      {selected.size > 0 ? (
        <div className="border-primary/20 bg-primary/5 flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-8">
          <span className="text-sm font-semibold">{selected.size}명 선택</span>
          <span className="bg-border mx-1 h-5 w-px" />
          <select
            onChange={(e) => {
              if (e.target.value) void bulkMove(e.target.value as Stage);
              e.target.value = '';
            }}
            defaultValue=""
            className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
          >
            <option value="" disabled>
              상태 변경…
            </option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={() => void bulkMove('연락 준비')}>
            연락 준비
          </Button>
          <Button size="sm" variant="outline" onClick={() => void bulkMove('제외')}>
            제외
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={bulkDelete}
            className="border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-400 dark:hover:bg-rose-500/10"
          >
            <Trash2 className="size-4" />
            삭제
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => setSelected(new Set())}
          >
            <X className="size-4" />
            선택 해제
          </Button>
        </div>
      ) : null}

      {/* Board */}
      {!hydrated ? (
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {STAGE_ORDER.slice(0, 5).map((s) => (
            <div key={s} className="w-72 shrink-0 space-y-3">
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div className="max-w-sm">
            <p className="text-lg font-semibold">아직 관리 중인 크리에이터가 없어요</p>
            <p className="text-muted-foreground mt-1.5 text-sm">
              검색에서 크리에이터를 저장하면 여기 파이프라인에 나타납니다.
            </p>
            <Button asChild className="mt-4">
              <a href="/discover">
                <Search className="size-4" />
                검색하러 가기
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto p-6">
          {STAGE_ORDER.map((stage) => (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={() => {
                if (dragId) void move(dragId, stage);
                setDragId(null);
                setOverStage(null);
              }}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-2xl transition-colors',
                overStage === stage && 'bg-primary/5 ring-primary/30 ring-2',
              )}
            >
              <div className="px-1 pb-3">
                <div className="flex items-center gap-2">
                  <span className={cn('size-2 rounded-full', STAGE_META[stage].dot)} />
                  <h2 className="text-sm font-semibold">{stage}</h2>
                  {byStage[stage].length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleSelectStage(byStage[stage].map((c) => c.id))}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                        byStage[stage].every((c) => selected.has(c.id))
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input text-muted-foreground hover:border-primary/50 hover:text-primary',
                      )}
                    >
                      {byStage[stage].every((c) => selected.has(c.id)) ? '전체해제' : '전체선택'}
                    </button>
                  ) : null}
                  <span className="dark:bg-muted dark:text-muted-foreground ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    {byStage[stage].length}
                  </span>
                </div>
                {stage === '연락 준비' && byStage[stage].filter((c) => c.followUpAt).length > 0 ? (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    후속 예정 {byStage[stage].filter((c) => c.followUpAt).length}
                  </p>
                ) : stage === '답변' && byStage[stage].length > 0 ? (
                  <p className="mt-1 text-[11px] text-fuchsia-600 dark:text-fuchsia-400">
                    답변 대기 {byStage[stage].length}
                  </p>
                ) : null}
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
                {byStage[stage].length === 0 ? (
                  <p className="text-muted-foreground/70 dark:border-border rounded-xl border border-dashed border-slate-200/60 py-6 text-center text-xs">
                    비어 있음
                  </p>
                ) : (
                  byStage[stage].map((card) => (
                    <CardView
                      key={card.id}
                      card={card}
                      selected={selected.has(card.id)}
                      menuOpen={menuId === card.id}
                      onToggleSelect={toggleSelect}
                      onOpenMenu={(id) => setMenuId((cur) => (cur === id ? null : id))}
                      onMove={(id, s) => {
                        setMenuId(null);
                        void move(id, s);
                      }}
                      onOpen={() => setOpenCard(card)}
                      onDragStart={() => setDragId(card.id)}
                      onDragEnd={() => setDragId(null)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error toast */}
      {error ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 shadow-lg dark:text-rose-400">
          <AlertCircle className="size-4" />
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="닫기">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <CreatorDrawer card={openCard} onClose={() => setOpenCard(null)} onError={setError} />
    </div>
  );
}

function FilterToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-9 rounded-lg border px-3 text-sm transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function CardView({
  card,
  selected,
  menuOpen,
  onToggleSelect,
  onOpenMenu,
  onMove,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  card: BoardCard;
  selected: boolean;
  menuOpen: boolean;
  onToggleSelect: (id: string, on: boolean) => void;
  onOpenMenu: (id: string) => void;
  onMove: (id: string, stage: Stage) => void;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={cn(
        'bg-card dark:border-border group relative cursor-pointer rounded-xl border border-slate-200/60 p-3 transition-all duration-150',
        'dark:hover:border-border hover:-translate-y-px hover:border-slate-300',
        selected && 'ring-primary/50 border-primary/40 ring-2',
      )}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onClick={stop}
          onChange={(e) => onToggleSelect(card.id, e.target.checked)}
          className="accent-primary mt-1 size-4 shrink-0 cursor-pointer"
          aria-label={`${card.name} 선택`}
        />
        {card.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external IG CDN
          <img
            src={card.profileImageUrl}
            alt=""
            className="size-9 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-medium">
            {card.name.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{card.name}</p>
          <p className="text-muted-foreground truncate text-xs">@{card.username}</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onOpenMenu(card.id);
            }}
            aria-label="상태 변경"
            className="text-muted-foreground hover:text-foreground rounded p-0.5"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen ? (
            <div
              onClick={stop}
              className="bg-popover absolute right-0 top-6 z-10 w-32 rounded-lg border p-1 shadow-lg"
            >
              {STAGE_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onMove(card.id, s)}
                  className={cn(
                    'hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs',
                    card.stage === s && 'font-medium',
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', STAGE_META[s].dot)} />
                  {s}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="text-muted-foreground mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="capitalize">{card.platform}</span>
        {card.followersCount != null ? (
          <span>· 팔로워 {formatCompactNumber(card.followersCount)}</span>
        ) : null}
        {card.tag ? (
          <span className="bg-secondary text-secondary-foreground rounded-full px-1.5 py-0.5">
            {card.tag}
          </span>
        ) : null}
      </div>

      {card.followUpAt || card.contactedAt || card.note ? (
        <div className="text-muted-foreground mt-2 space-y-0.5 text-xs">
          {card.contactedAt ? (
            <p className="flex items-center gap-1">
              <Send className="size-3" />
              최근 연락 {card.contactedAt.slice(0, 10)}
            </p>
          ) : null}
          {card.followUpAt ? (
            <p className="flex items-center gap-1">
              <CalendarClock className="size-3" />
              후속 {card.followUpAt}
            </p>
          ) : null}
          {card.note ? <p className="truncate">📝 {card.note}</p> : null}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between">
        <a
          href={card.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stop}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <Instagram className="size-3.5" />
          프로필
        </a>
      </div>
    </div>
  );
}
