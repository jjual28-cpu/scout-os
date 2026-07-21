'use client';

import { Check, Copy, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/utils';

import { type SavedOpportunity } from '../types';
import { OpportunityBody } from './opportunity-body';

type OutreachCardProps = {
  item: SavedOpportunity;
  draft: string | undefined;
  /** kind: 'ai' = AI가 통째로 작성 / 'style' = 저장한 내 DM 스타일 사용. */
  onGenerate: (kind: 'ai' | 'style') => void | Promise<void>;
  /** 저장한 DM 스타일이 있는지 — 있으면 '내 스타일 DM' 버튼도 보여준다. */
  hasTemplate: boolean;
};

export function OutreachCard({ item, draft, onGenerate, hasTemplate }: OutreachCardProps) {
  const [genKind, setGenKind] = useState<'ai' | 'style' | null>(null);
  const [copied, setCopied] = useState(false);

  const runGenerate = async (kind: 'ai' | 'style') => {
    if (genKind) return;
    setGenKind(kind);
    try {
      await onGenerate(kind);
    } finally {
      setGenKind(null);
    }
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
          <div className="flex gap-2">
            <Button
              type="button"
              className={hasTemplate ? 'flex-1' : 'w-full'}
              onClick={() => void runGenerate('ai')}
              disabled={genKind !== null}
            >
              {genKind === 'ai' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              AI DM 생성
            </Button>
            {hasTemplate ? (
              <Button
                type="button"
                variant="outline"
                className="border-primary/40 text-primary flex-1"
                onClick={() => void runGenerate('style')}
                disabled={genKind !== null}
              >
                {genKind === 'style' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wand2 className="size-4" />
                )}
                내 스타일 DM
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-primary/80 text-[11px] font-medium uppercase tracking-wide">
              DM 초안
            </p>

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
                onClick={() => void runGenerate('ai')}
                disabled={genKind !== null}
              >
                {genKind === 'ai' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                AI
              </Button>
              {hasTemplate ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-primary/40 text-primary"
                  onClick={() => void runGenerate('style')}
                  disabled={genKind !== null}
                >
                  {genKind === 'style' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wand2 className="size-4" />
                  )}
                  내 스타일
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
