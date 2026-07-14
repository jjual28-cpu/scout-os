'use client';

import { AlertCircle, Package, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useProducts } from '../hooks/use-products';
import {
  COLLAB_TYPES,
  PRODUCT_STATUSES,
  emptyProduct,
  generateProductCode,
  splitTokens,
  type Product,
  type ProductStatus,
} from '../types';

const STATUS_STYLE: Record<ProductStatus, string> = {
  판매중: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  준비중: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  품절: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  중지: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
};

type SortKey = 'recent' | 'name' | 'brand' | 'status';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function uuid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  }
}

export function ProductsPage() {
  const { products, hydrated, error, clearError, create, update, remove } = useProducts();
  const [draft, setDraft] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2000);
  };

  // Toolbar
  const [q, setQ] = useState('');
  const [brandQ, setBrandQ] = useState('');
  const [category, setCategory] = useState('전체');
  const [status, setStatus] = useState('전체');
  const [sort, setSort] = useState<SortKey>('recent');

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))],
    [products],
  );

  const list = useMemo(() => {
    const filtered = products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
      if (brandQ && !p.brand.toLowerCase().includes(brandQ.trim().toLowerCase())) return false;
      if (category !== '전체' && p.category !== category) return false;
      if (status !== '전체' && p.status !== status) return false;
      return true;
    });
    const arr = [...filtered];
    if (sort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'brand') arr.sort((a, b) => a.brand.localeCompare(b.brand));
    else if (sort === 'status')
      arr.sort((a, b) => PRODUCT_STATUSES.indexOf(a.status) - PRODUCT_STATUSES.indexOf(b.status));
    else arr.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')); // recent
    return arr;
  }, [products, q, brandQ, category, status, sort]);

  const startNew = () => {
    const code = generateProductCode(products.map((p) => p.productCode));
    setDraft({ ...emptyProduct(uuid()), productCode: code });
    setIsNew(true);
    setFormError(null);
  };
  const select = (p: Product) => {
    setDraft({ ...p });
    setIsNew(false);
    setFormError(null);
  };
  const set = <K extends keyof Product>(key: K, value: Product[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setFormError('상품명을 입력해 주세요.');
      return;
    }
    setSaving(true);
    const ok = isNew ? await create(draft) : await update(draft.id, draft);
    setSaving(false);
    if (ok) setIsNew(false);
  };
  const doDelete = async () => {
    if (!draft) return;
    setConfirmDelete(false);
    const ok = await remove(draft.id);
    if (ok) setDraft(null);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="Products"
        description="브랜드 상품을 등록하면 AI가 이 데이터로 키워드·셀럽을 추천합니다."
        actions={
          <Button onClick={startNew}>
            <Plus className="size-4" />새 상품
          </Button>
        }
      />

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 flex items-center gap-2 rounded-lg border p-3 text-sm">
          <AlertCircle className="size-4" />
          {error}
          <button type="button" onClick={clearError} className="ml-auto" aria-label="닫기">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="상품명 검색"
            className="border-input bg-background focus-visible:ring-ring h-9 w-44 rounded-lg border pl-8 pr-3 text-sm outline-none focus-visible:ring-2"
          />
        </div>
        <input
          value={brandQ}
          onChange={(e) => setBrandQ(e.target.value)}
          placeholder="브랜드 검색"
          className="border-input bg-background focus-visible:ring-ring h-9 w-36 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2"
        />
        <ToolbarSelect value={category} onChange={setCategory} options={['전체', ...categories]} />
        <ToolbarSelect
          value={status}
          onChange={setStatus}
          options={['전체', ...PRODUCT_STATUSES]}
        />
        <ToolbarSelect
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          options={['recent', 'name', 'brand', 'status']}
          labels={{ recent: '최근 등록순', name: '상품명순', brand: '브랜드순', status: '상태순' }}
        />
        <span className="text-muted-foreground ml-auto text-sm">{list.length}개</span>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* List */}
        <aside className={cn('space-y-2', draft && 'hidden lg:block')}>
          {!hydrated ? (
            <>
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </>
          ) : list.length === 0 ? (
            <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
              {products.length === 0 ? (
                <>
                  아직 등록된 상품이 없어요.
                  <br />
                  <span className="text-foreground">‘새 상품’</span>으로 첫 상품을 등록하세요.
                </>
              ) : (
                '조건에 맞는 상품이 없어요.'
              )}
            </div>
          ) : (
            list.map((p) => (
              <ProductRow
                key={p.id}
                p={p}
                active={draft?.id === p.id && !isNew}
                onClick={() => select(p)}
                onAiStart={() => showToast('AI 상품 분석은 준비 중입니다. 곧 제공됩니다.')}
              />
            ))
          )}
        </aside>

        {/* Editor */}
        <div className={cn(!draft && 'hidden lg:block')}>
          {!draft ? (
            <div className="text-muted-foreground dark:border-border flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-200/60 text-center text-sm">
              왼쪽에서 상품을 선택하거나 ‘새 상품’을 눌러 등록하세요.
            </div>
          ) : (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm lg:hidden"
              >
                ← 목록으로
              </button>
              {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

              <Section title="기본 정보">
                <ImageField
                  value={draft.imageUrl}
                  onChange={(v) => set('imageUrl', v)}
                  onError={setFormError}
                />
                <Field label="상품명" full>
                  <Input
                    value={draft.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="예: 바노티 립밤"
                  />
                </Field>
                <Field label="브랜드">
                  <Input value={draft.brand} onChange={(e) => set('brand', e.target.value)} />
                </Field>
                <Field label="카테고리">
                  <Input
                    value={draft.category}
                    onChange={(e) => set('category', e.target.value)}
                    placeholder="예: 뷰티"
                  />
                </Field>
                <Field label="상태">
                  <Select
                    value={draft.status}
                    onChange={(v) => set('status', v as ProductStatus)}
                    options={PRODUCT_STATUSES}
                  />
                </Field>
                <Field label="상품 코드">
                  <div className="flex gap-2">
                    <Input
                      value={draft.productCode}
                      onChange={(e) => set('productCode', e.target.value)}
                      placeholder="예: VNT001"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() =>
                        set(
                          'productCode',
                          generateProductCode(
                            products
                              .map((p) => p.productCode)
                              .filter((c) => c !== draft.productCode),
                            draft.brand,
                            draft.name,
                          ),
                        )
                      }
                    >
                      자동
                    </Button>
                  </div>
                </Field>
                <Field label="검색·AI 대상">
                  <button
                    type="button"
                    onClick={() => set('isActive', !draft.isActive)}
                    aria-pressed={draft.isActive}
                    className={cn(
                      'inline-flex h-10 w-full items-center gap-2 rounded-md border px-3 text-sm',
                      draft.isActive
                        ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        draft.isActive ? 'bg-emerald-500' : 'bg-muted-foreground',
                      )}
                    />
                    {draft.isActive ? '활성 (검색에 노출)' : '비활성'}
                  </button>
                </Field>
              </Section>

              <Section title="가격 · 협업 조건">
                <Field label="판매가 (원)">
                  <NumInput value={draft.price} onChange={(v) => set('price', v)} />
                </Field>
                <Field label="수수료 (%)">
                  <NumInput value={draft.commission} onChange={(v) => set('commission', v)} />
                </Field>
                <Field label="기본 수익쉐어율 (%)">
                  <NumInput
                    value={draft.revenueSharePct}
                    onChange={(v) => set('revenueSharePct', v)}
                  />
                </Field>
                <Field label="협업 제공 방식 (복수 선택)" full>
                  <CheckboxGroup
                    value={draft.collabType}
                    options={COLLAB_TYPES}
                    onChange={(v) => set('collabType', v)}
                  />
                </Field>
                <Field label="협업 조건" full>
                  <Textarea
                    value={draft.collabTerms}
                    onChange={(v) => set('collabTerms', v)}
                    placeholder="협업 조건, 정산 방식 등"
                  />
                </Field>
              </Section>

              <Section title="마케팅 · AI">
                <Field label="USP (차별점)" full>
                  <Textarea value={draft.usp} onChange={(v) => set('usp', v)} rows={2} />
                </Field>
                <Field label="판매 포인트" full>
                  <Textarea value={draft.sellingPoints} onChange={(v) => set('sellingPoints', v)} />
                </Field>
                <Field label="추천 타겟" full>
                  <Input
                    value={draft.target}
                    onChange={(e) => set('target', e.target.value)}
                    placeholder="예: 20~30대 여성, 뷰티 관심"
                  />
                </Field>
                <Field label="추천 키워드 (Enter로 추가 · AI Engine 사용)" full>
                  <TagInput
                    value={draft.recommendedKeywords}
                    onChange={(v) => set('recommendedKeywords', v)}
                    placeholder="예: 뷰티, 메이크업 …"
                  />
                </Field>
              </Section>

              <Section title="주의 문구">
                <Field label="금지 문구" full>
                  <Textarea
                    value={draft.bannedPhrases}
                    onChange={(v) => set('bannedPhrases', v)}
                    rows={2}
                    placeholder="광고 시 사용 금지 표현"
                  />
                </Field>
              </Section>

              <div className="flex items-center gap-2">
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? '저장 중…' : isNew ? '상품 등록' : '변경 저장'}
                </Button>
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  취소
                </Button>
                {!isNew ? (
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmDelete(true)}
                    className="text-destructive ml-auto"
                  >
                    <Trash2 className="size-4" />
                    삭제
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          title="상품을 삭제할까요?"
          message="정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void doDelete()}
        />
      ) : null}

      {toast ? (
        <div className="bg-foreground text-background fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function ProductRow({
  p,
  active,
  onClick,
  onAiStart,
}: {
  p: Product;
  active: boolean;
  onClick: () => void;
  onAiStart: () => void;
}) {
  const collab = splitTokens(p.collabType);
  return (
    <div
      className={cn(
        'dark:border-border flex w-full items-start gap-3 rounded-xl border border-slate-200/60 p-3 transition-colors',
        active ? 'border-primary/40 bg-primary/5' : 'dark:hover:bg-muted/50 hover:bg-slate-50/70',
        !p.isActive && 'opacity-55',
      )}
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 gap-3 text-left">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-provided URL / data URI
          <img src={p.imageUrl} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-lg">
            <Package className="size-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium">{p.name || '(제목 없음)'}</p>
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[11px]',
                STATUS_STYLE[p.status],
              )}
            >
              {p.status}
            </span>
            {!p.isActive ? (
              <span className="text-muted-foreground shrink-0 text-[11px]">비활성</span>
            ) : null}
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {p.productCode ? <span className="font-mono">{p.productCode}</span> : null}
            {p.productCode && (p.brand || p.category) ? ' · ' : ''}
            {p.brand || '브랜드 미정'}
            {p.category ? ` · ${p.category}` : ''}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {p.revenueSharePct != null ? `수익쉐어 ${p.revenueSharePct}%` : ''}
            {p.revenueSharePct != null && collab.length ? ' · ' : ''}
            {collab.join(', ')}
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAiStart();
        }}
        title="AI 상품 분석 시작"
        className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 self-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
      >
        🤖 AI 시작
      </button>
    </div>
  );
}

// ── Inputs ───────────────────────────────────────────────────────────────────
function ImageField({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (v: string) => void;
  onError: (msg: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      onError('이미지는 2MB 이하로 업로드해 주세요.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onError(null);
      onChange(String(reader.result));
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="sm:col-span-2">
      <span className="text-muted-foreground mb-1 block text-xs font-medium">대표 이미지</span>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- user URL / data URI
          <img src={value} alt="" className="size-14 shrink-0 rounded-lg border object-cover" />
        ) : (
          <div className="bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-lg border">
            <Package className="size-5" />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="이미지 URL (https://…)"
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              업로드
            </Button>
            {value ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')}>
                제거
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const tokens = splitTokens(value);
  const add = (t: string) => {
    const token = t.trim().replace(/,$/, '').trim();
    if (!token) return;
    onChange([...new Set([...tokens, token])].join(', '));
    setText('');
  };
  const removeAt = (t: string) => onChange(tokens.filter((x) => x !== t).join(', '));
  return (
    <div className="border-input bg-background focus-within:ring-ring flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:ring-2">
      {tokens.map((t) => (
        <span
          key={t}
          className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
        >
          {t}
          <button type="button" onClick={() => removeAt(t)} aria-label={`${t} 삭제`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(text);
          } else if (e.key === 'Backspace' && !text && tokens.length) {
            removeAt(tokens[tokens.length - 1]!);
          }
        }}
        onBlur={() => add(text)}
        placeholder={tokens.length ? '' : placeholder}
        className="min-w-[80px] flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

function CheckboxGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  const selected = new Set(splitTokens(value));
  const toggle = (o: string) => {
    const next = new Set(selected);
    next.has(o) ? next.delete(o) : next.add(o);
    onChange([...next].join(', '));
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.has(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            aria-pressed={on}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors',
              on
                ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className={cn('size-3.5 rounded-sm border', on && 'border-primary bg-primary')} />
            {o}
          </button>
        );
      })}
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} aria-hidden />
      <div className="bg-card relative w-full max-w-sm rounded-2xl border p-5 shadow-2xl">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            취소
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            삭제
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dark:border-border rounded-xl border border-slate-200/60 p-5">
      <h2 className="dark:text-muted-foreground mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h2>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('block', full && 'sm:col-span-2')}>
      <span className="text-muted-foreground mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function NumInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Input
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border-input bg-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function ToolbarSelect({
  value,
  onChange,
  options,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border-input bg-background h-9 rounded-lg border px-2.5 text-sm"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}

function Textarea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
    />
  );
}
