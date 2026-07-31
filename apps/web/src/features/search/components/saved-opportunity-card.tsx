'use client';

import { Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { STATUS_META, STATUS_ORDER } from '../status';
import { type OpportunityStatus, type SavedOpportunity } from '../types';
import { OpportunityBody } from './opportunity-body';

type SavedOpportunityCardProps = {
  item: SavedOpportunity;
  /** CRM 태그(outreach 레코드에서). 있으면 카드에 칩으로 표시. */
  tags?: string[];
  onStatusChange: (id: string, status: OpportunityStatus) => void;
  onNoteChange: (id: string, note: string) => void;
  onRemove: (id: string) => void;
};

export function SavedOpportunityCard({
  item,
  tags = [],
  onStatusChange,
  onNoteChange,
  onRemove,
}: SavedOpportunityCardProps) {
  // Memo is edited via local state; persistence is a side effect on each change,
  // so the input stays smooth and never loses focus on re-render.
  const [note, setNote] = useState(item.note);

  return (
    <article className="bg-card flex flex-col rounded-2xl border p-5">
      <OpportunityBody result={item} />

      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="bg-primary/10 text-primary inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
            >
              <Tag className="size-2.5" />
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {/* 상태 */}
      <div className="mt-5 border-t pt-4">
        <p className="text-muted-foreground mb-2 text-[11px] font-medium uppercase tracking-wide">
          상태
        </p>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((status) => {
            const active = item.status === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => onStatusChange(item.id, status)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  active
                    ? STATUS_META[status].active
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {status}
              </button>
            );
          })}
        </div>
      </div>

      {/* 메모 */}
      <div className="mt-4">
        <label
          htmlFor={`note-${item.id}`}
          className="text-muted-foreground mb-2 block text-[11px] font-medium uppercase tracking-wide"
        >
          메모
        </label>
        <textarea
          id={`note-${item.id}`}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            onNoteChange(item.id, e.target.value);
          }}
          placeholder="예: 뷰티 브랜드로 성장 가능성 있음"
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground/70 focus-visible:ring-ring min-h-[68px] w-full resize-y rounded-lg border p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2"
        />
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(item.id)}
        >
          <Trash2 className="size-4" />
          삭제
        </Button>
      </div>
    </article>
  );
}
