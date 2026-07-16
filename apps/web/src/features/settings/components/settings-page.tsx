'use client';

import { CheckCircle2, ExternalLink, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { SectionCard, StatusBadge } from '@/components/layout/blocks';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { useAiConnection } from '../hooks/use-ai-connection';

// Free-tier Gemini models (kept in sync with services/ai/gemini.ts).
const MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (추천)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (가장 빠름)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

type TestState = { kind: 'idle' | 'ok' | 'fail'; message?: string };

export function SettingsPage() {
  const { conn, loading, reload } = useAiConnection();

  const [key, setKey] = useState('');
  const [model, setModel] = useState(MODELS[0]!.id);
  const [busy, setBusy] = useState<null | 'connect' | 'test' | 'disconnect'>(null);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });

  async function connect() {
    setError(null);
    setBusy('connect');
    try {
      const res = await fetch('/api/ai/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), model }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: unknown;
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        setError(json?.error?.message ?? '연결에 실패했습니다.');
        return;
      }
      setKey(''); // never keep the key in memory after it's stored
      await reload();
    } catch {
      setError('연결 중 문제가 발생했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function runTest() {
    setTest({ kind: 'idle' });
    setBusy('test');
    try {
      const res = await fetch('/api/ai/test', { method: 'POST' });
      const json = (await res.json().catch(() => null)) as {
        data?: { sample?: string };
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        setTest({ kind: 'fail', message: json?.error?.message ?? '테스트에 실패했습니다.' });
        return;
      }
      setTest({ kind: 'ok', message: json?.data?.sample || '정상 응답을 받았습니다.' });
    } catch {
      setTest({ kind: 'fail', message: '테스트 중 문제가 발생했습니다.' });
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy('disconnect');
    setTest({ kind: 'idle' });
    try {
      await fetch('/api/ai/disconnect', { method: 'POST' });
      await reload();
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader title="설정" description="AI 연결과 기본 작업 환경을 관리합니다." />

      <SectionCard
        title="AI 연결"
        icon={<Sparkles className="size-4" />}
        action={
          conn.connected ? (
            <StatusBadge tone="emerald">
              <CheckCircle2 className="size-3" />
              연결됨
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral">미연결</StatusBadge>
          )
        }
      >
        {loading ? (
          <p className="text-muted-foreground text-sm">불러오는 중…</p>
        ) : conn.connected ? (
          <div className="space-y-4">
            <div className="dark:border-border grid gap-3 rounded-lg border border-slate-200/60 p-4 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">제공자</p>
                <p className="text-sm font-medium">Google Gemini · 무료</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">API 키</p>
                <p className="text-sm font-medium tabular-nums">••••••••{conn.last4 ?? '····'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">모델</p>
                <p className="text-sm font-medium">
                  {MODELS.find((m) => m.id === conn.model)?.label ?? conn.model ?? '—'}
                </p>
              </div>
            </div>

            {test.kind !== 'idle' ? (
              <p
                className={cn(
                  'text-sm',
                  test.kind === 'ok' ? 'text-emerald-600' : 'text-destructive',
                )}
              >
                {test.kind === 'ok' ? '✓ ' : '✗ '}
                {test.message}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void runTest()} disabled={!!busy}>
                {busy === 'test' ? <Loader2 className="size-4 animate-spin" /> : null}
                연결 테스트
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void disconnect()}
                disabled={!!busy}
                className="text-destructive hover:text-destructive"
              >
                {busy === 'disconnect' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                연결 해제
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              AI 분석·DM 작성은 회원님이 연결한 <span className="font-medium">Google Gemini</span>{' '}
              계정으로 동작합니다. 무료 키로 하루 약 1,500회까지 무료예요. Scout OS는 별도 AI 요금을
              청구하지 않습니다.
            </p>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              무료 API 키 발급받기 (Google AI Studio)
              <ExternalLink className="size-3.5" />
            </a>

            <div className="space-y-2">
              <Label htmlFor="ai-key">Gemini API 키</Label>
              <Input
                id="ai-key"
                type="password"
                autoComplete="off"
                placeholder="AIza… 로 시작하는 키를 붙여넣으세요"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-model">모델</Label>
              <select
                id="ai-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            <Button onClick={() => void connect()} disabled={!!busy || key.trim().length < 20}>
              {busy === 'connect' ? <Loader2 className="size-4 animate-spin" /> : null}
              연결하기
            </Button>

            <p className="text-muted-foreground text-xs leading-relaxed">
              키는 암호화되어 서버에만 저장되며 화면에 다시 표시되지 않습니다. 무료 등급은 입력
              내용이 Google 모델 학습에 사용될 수 있어요 — 민감한 정보가 걱정되면 Google AI
              Studio에서 유료 등급으로 전환하면 학습에 쓰이지 않습니다.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
