'use client';

import { Loader2, Sparkles, Send } from 'lucide-react';
import { useState } from 'react';

import { MessageKind } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useGenerateDm } from '../hooks/use-generate-dm';

/**
 * AI DM composer: generate a first-contact draft, edit it inline, then send.
 * Sending is left to the platform integration layer.
 */
export function DmComposer({ dealId }: { dealId: string }) {
  const [body, setBody] = useState('');
  const { mutate, isPending } = useGenerateDm();

  const generate = () =>
    mutate(
      { dealId, kind: MessageKind.DM, tone: 'friendly' },
      { onSuccess: (msg) => setBody(msg.body) },
    );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">AI DM 작성</CardTitle>
        <Button size="sm" variant="outline" onClick={generate} disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          생성
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="‘생성’을 눌러 AI 초안을 받거나 직접 작성하세요."
          className="border-input bg-background ring-offset-background focus-visible:ring-ring min-h-32 w-full resize-y rounded-md border p-3 text-sm focus-visible:outline-none focus-visible:ring-2"
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={!body.trim()}>
            <Send className="size-4" /> 보내기
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
