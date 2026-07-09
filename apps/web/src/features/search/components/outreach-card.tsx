'use client';

import { Check, Copy, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/utils';

import { type SavedOpportunity } from '../types';
import { OpportunityBody } from './opportunity-body';

type OutreachCardProps = {
  item: SavedOpportunity;
  draft: string | undefined;
  onGenerate: () => void;
};

export function OutreachCard({ item, draft, onGenerate }: OutreachCardProps) {
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const runGenerate = () => {
    setGenerating(true);
    // Brief simulated latency so it feels like drafting — no AI/API is called.
    window.setTimeout(() => {
      onGenerate();
      setGenerating(false);
    }, 700);
  };

  const copy = async () => {
    if (!draft) return;
    const ok = await copyToClipboard(draft);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <article className="bg-card flex flex-col rounded-2xl border p-5">
      <OpportunityBody result={item} />

      {/* 메모 */}
      <div className="mt-5 border-t pt-4">
        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          메모
        </p>
        <p className="text-foreground/90 mt-1 text-sm">
          {item.note ? item.note : <span className="text-muted-foreground">메모 없음</span>}
        </p>
      </div>

      {/* DM 초안 */}
      <div className="mt-4">
        {!draft ? (
          <Button type="button" className="w-full" onClick={runGenerate} disabled={generating}>
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {generating ? 'DM 초안 생성 중…' : 'DM 초안 생성'}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-primary/80 text-[11px] font-medium uppercase tracking-wide">
                DM 초안
              </p>
              <span className="text-muted-foreground text-[11px]">AI 생성 (mock)</span>
            </div>

            <div className="bg-muted/40 whitespace-pre-wrap rounded-lg border p-3 text-sm leading-relaxed">
              {draft}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={copied ? 'secondary' : 'default'}
                className="flex-1"
                aria-label="DM 복사"
                onClick={copy}
              >
                {copied ? (
                  <>
                    <Check className="size-4" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    복사
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={runGenerate}
                disabled={generating}
                aria-label="다시 생성"
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                다시 생성
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
