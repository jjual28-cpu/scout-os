'use client';

import { Plus, Tag, X } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

/** 자주 쓰는 태그 추천 — 클릭 한 번으로 추가. */
const SUGGESTED = ['재컨택', '우선순위', '뷰티', '패션', '푸드', '10만+', '협의중', '보류'];

/**
 * 셀럽 자유 태그 편집기(칩 + 추가 입력 + 추천). 상세 페이지·CRM 드로어에서 공용.
 * 값/저장은 부모(outreach.setTags)가 소유 — 여기선 표시·입력만 담당한다.
 */
export function TagEditor({
  tags,
  onChange,
  className,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const [input, setInput] = useState('');

  const add = (raw: string) => {
    const t = raw.trim();
    if (!t || tags.includes(t)) {
      setInput('');
      return;
    }
    onChange([...tags, t]);
    setInput('');
  };
  const remove = (t: string) => onChange(tags.filter((x) => x !== t));

  const unused = SUGGESTED.filter((s) => !tags.includes(s));

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
          >
            <Tag className="size-3" />
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              aria-label={`${t} 태그 제거`}
              className="hover:text-primary/70 -mr-0.5"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <span className="inline-flex items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(input);
              } else if (e.key === 'Backspace' && !input && tags.length) {
                remove(tags[tags.length - 1]!);
              }
            }}
            onBlur={() => add(input)}
            placeholder={tags.length ? '태그 추가' : '태그 추가 (Enter)'}
            className="border-input bg-background focus-visible:ring-ring h-7 w-28 rounded-full border px-2.5 text-xs outline-none focus-visible:ring-2"
          />
        </span>
      </div>
      {unused.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="text-muted-foreground hover:border-primary/40 hover:text-primary inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-[11px] transition-colors"
            >
              <Plus className="size-2.5" />
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
