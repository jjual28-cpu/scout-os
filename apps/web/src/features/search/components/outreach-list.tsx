'use client';

import { Send } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { generateDmDraft } from '../dm';
import { useDmDrafts } from '../hooks/use-dm-drafts';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';
import { OutreachCard } from './outreach-card';

export function OutreachList() {
  const { saved, hydrated } = useSavedOpportunities();
  const { getDraft, setDraft } = useDmDrafts();

  const items = saved.filter((s) => s.status === '연락예정');

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">연락 준비</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {hydrated ? `‘연락예정’ 상태의 기회 ${items.length}건 — DM 초안을 준비하세요.` : ' '}
        </p>
      </div>

      {!hydrated ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
          <div className="bg-muted mb-4 flex size-12 items-center justify-center rounded-2xl">
            <Send className="text-muted-foreground size-6" />
          </div>
          <p className="font-medium">연락예정 기회가 없습니다</p>
          <p className="text-muted-foreground mt-1 text-sm">
            저장한 기회의 상태를 &lsquo;연락예정&rsquo;으로 바꾸면 여기에 모입니다.
          </p>
          <Button asChild className="mt-6">
            <Link href="/saved">저장한 기회로 가기</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <OutreachCard
              key={item.id}
              item={item}
              draft={getDraft(item.id)}
              onGenerate={() => setDraft(item.id, generateDmDraft(item))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
