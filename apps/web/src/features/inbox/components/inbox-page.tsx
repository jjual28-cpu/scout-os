'use client';

import { Inbox, Loader2, RefreshCw, Send, Sparkles, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { useProducts } from '@/features/products/hooks/use-products';
import { cn } from '@/lib/utils';

import { useInbox, type InboxThread } from '../hooks/use-inbox';

type Status = { configured: boolean; connected: boolean; username: string | null };

export function InboxPage() {
  const { threads, hydrated, reload, markRead } = useInbox();
  const { products } = useProducts();
  const [status, setStatus] = useState<Status | null>(null);
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/instagram/status');
        const json = await res.json();
        if (res.ok) setStatus(json.data as Status);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const active: InboxThread | null = useMemo(
    () => threads.find((t) => t.peerId === activePeer) ?? null,
    [threads, activePeer],
  );

  const openThread = (t: InboxThread) => {
    setActivePeer(t.peerId);
    setReply('');
    setError(null);
    if (t.unread > 0) void markRead(t.peerId);
  };

  const brand = products[0]
    ? {
        productName: products[0].name,
        brand: products[0].brand,
        sellingPoints: products[0].sellingPoints,
      }
    : null;

  const aiReply = async () => {
    if (!active || aiLoading) return;
    setAiLoading(true);
    setError(null);
    try {
      const conversation = active.messages
        .filter((m) => m.text)
        .map((m) => ({ direction: m.direction, text: m.text as string }));
      const res = await fetch('/api/ai/dm-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation, brand }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'AI 답장 생성에 실패했어요.');
        return;
      }
      setReply(json.data.text ?? '');
    } catch {
      setError('AI 답장 생성 중 문제가 생겼어요.');
    } finally {
      setAiLoading(false);
    }
  };

  const send = async () => {
    if (!active || sending || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/instagram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerId: active.peerId,
          peerUsername: active.peerUsername,
          text: reply.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // 24시간 창 밖 등 — 정직하게 알리고 ig.me 붙여넣기로 폴백.
        setError(
          (json?.error?.message ?? '발송에 실패했어요.') +
            (active.peerUsername ? ' 아래 “인스타에서 직접”으로 보내보세요.' : ''),
        );
        return;
      }
      setReply('');
      await reload();
    } catch {
      setError('발송 중 문제가 생겼어요.');
    } finally {
      setSending(false);
    }
  };

  const igmeHref = active?.peerUsername
    ? `https://ig.me/m/${encodeURIComponent(active.peerUsername)}`
    : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title="받은 답장"
        description="셀럽이 DM에 답장하면 여기에 모여요. 인스타에 들어가지 않아도 확인·답장할 수 있어요."
        actions={
          <Button variant="outline" onClick={() => void reload()}>
            <RefreshCw className="size-4" />
            새로고침
          </Button>
        }
      />

      {status && !status.connected ? (
        <div className="border-primary/20 bg-primary/[0.04] mt-4 flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
          <TriangleAlert className="text-primary size-4" />
          <span className="text-muted-foreground">
            {status.configured
              ? '인스타 계정을 연결하면 답장이 여기로 들어와요.'
              : '관리자가 인스타 앱을 설정하면 답장 수집이 켜집니다.'}
          </span>
          {status.configured ? (
            <Button asChild size="sm" className="ml-auto">
              <Link href="/settings">설정에서 연결</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Threads */}
        <aside className={cn('space-y-1.5', active && 'hidden lg:block')}>
          {!hydrated ? (
            <p className="text-muted-foreground text-sm">불러오는 중…</p>
          ) : threads.length === 0 ? (
            <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
              아직 받은 답장이 없어요.
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.peerId}
                type="button"
                onClick={() => openThread(t)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-xl border p-3 text-left transition-colors',
                  active?.peerId === t.peerId
                    ? 'border-primary/40 bg-primary/5'
                    : 'dark:border-border dark:hover:bg-muted/50 border-slate-200/60 hover:bg-slate-50/70',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">
                      {t.peerUsername ? `@${t.peerUsername}` : `셀럽 ${t.peerId.slice(-6)}`}
                    </p>
                    {t.unread > 0 ? (
                      <span className="bg-primary text-primary-foreground ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                        {t.unread}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {t.last.direction === 'out' ? '나: ' : ''}
                    {t.last.text ?? ''}
                  </p>
                </div>
              </button>
            ))
          )}
        </aside>

        {/* Conversation */}
        <div className={cn(!active && 'hidden lg:block')}>
          {!active ? (
            <div className="text-muted-foreground dark:border-border flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-200/60 text-center text-sm">
              <span>
                <Inbox className="mx-auto mb-2 size-6 opacity-60" />
                왼쪽에서 대화를 선택하세요.
              </span>
            </div>
          ) : (
            <div className="dark:border-border flex flex-col rounded-2xl border border-slate-200/60">
              <div className="flex items-center gap-2 border-b p-4">
                <button
                  type="button"
                  onClick={() => setActivePeer(null)}
                  className="text-muted-foreground hover:text-foreground text-sm lg:hidden"
                >
                  ← 목록
                </button>
                <h2 className="text-sm font-semibold">
                  {active.peerUsername
                    ? `@${active.peerUsername}`
                    : `셀럽 ${active.peerId.slice(-6)}`}
                </h2>
              </div>

              <div className="max-h-[46vh] space-y-2 overflow-y-auto p-4">
                {active.messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn('flex', m.direction === 'out' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
                        m.direction === 'out'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground',
                      )}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 border-t p-4">
                {error ? (
                  <p className="text-destructive text-xs">
                    {error}
                    {igmeHref ? (
                      <>
                        {' '}
                        <a
                          href={igmeHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          인스타에서 직접
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder="답장을 쓰거나 ‘AI 답장’을 눌러 초안을 만들어 보세요."
                  className="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
                />
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => void aiReply()} disabled={aiLoading}>
                    {aiLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    AI 답장
                  </Button>
                  <Button onClick={() => void send()} disabled={sending || !reply.trim()}>
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    발송
                  </Button>
                  <span className="text-muted-foreground ml-auto text-[11px]">
                    답장은 상대가 보낸 뒤 24시간 이내만 전송돼요.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
