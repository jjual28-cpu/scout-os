'use client';

import { Loader2, Sparkles } from 'lucide-react';

import { AnalysisKind } from '@scout-os/database';

import { Button } from '@/components/ui/button';

import { useAnalyzeCreator } from '../hooks/use-analyze-creator';

export function AnalyzeButton({ creatorId }: { creatorId: string }) {
  const { mutate, isPending } = useAnalyzeCreator();

  return (
    <Button
      size="sm"
      onClick={() => mutate({ creatorId, kind: AnalysisKind.FIT })}
      disabled={isPending}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      AI 분석 실행
    </Button>
  );
}
