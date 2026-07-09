'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Platform } from '@/types';

import { useDiscoveryRun } from '../hooks/use-discovery-run';

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: Platform.INSTAGRAM, label: 'Instagram' },
  { value: Platform.YOUTUBE, label: 'YouTube' },
  { value: Platform.TIKTOK, label: 'TikTok' },
  { value: Platform.BLOG, label: 'Blog' },
];

const EXAMPLES = [
  '자기 브랜드를 운영하는 뷰티 마이크로 크리에이터',
  '최근 성장 중인 홈트레이닝 유튜버',
  '주방용품 공동구매 셀러',
];

/**
 * The natural-language "brief" box that kicks off an AI discovery run.
 * This is the primary entry point of the product — describe who you want,
 * Scout OS goes and finds them.
 */
export function DiscoveryLauncher() {
  const [prompt, setPrompt] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>([Platform.INSTAGRAM]);
  const { mutate, isPending } = useDiscoveryRun();

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const launch = () => {
    if (prompt.trim().length < 4 || platforms.length === 0) return;
    mutate({ prompt, platforms, targetCount: 50 });
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-4 p-6">
        <div className="text-primary flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4" />
          발굴 브리프
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && launch()}
            placeholder="어떤 크리에이터·브랜드·셀러를 찾을까요?"
            className="flex-1"
          />
          <Button onClick={launch} disabled={isPending} size="lg">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            발굴 시작
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PLATFORM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => togglePlatform(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                platforms.includes(opt.value)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
          <span>예시:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPrompt(ex)}
              className="hover:text-foreground underline-offset-2 hover:underline"
            >
              {ex}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
