'use client';

import { CheckCircle2, Instagram } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

type Status = { configured: boolean; connected: boolean; username: string | null };

/**
 * 설정의 "인스타그램 연결" — 셀럽 답장을 어드민(받은 답장)에서 받으려면 오너의
 * 프로 계정을 연결해야 한다. 연결 버튼은 OAuth(/api/instagram/authorize)로 보낸다.
 */
export function InstagramConnectCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const params = useSearchParams();
  const flag = params.get('instagram');

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

  // 웹훅 구독 재시도(복구용). OAuth 직후 구독이 실패했을 때 답장 수신을 다시 켠다.
  const [subState, setSubState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const resubscribe = async () => {
    setSubState('loading');
    try {
      const res = await fetch('/api/instagram/subscribe', { method: 'POST' });
      setSubState(res.ok ? 'ok' : 'error');
    } catch {
      setSubState('error');
    }
  };

  // 연동 해제 — 저장된 액세스 토큰·연동정보를 삭제한다(개인정보처리방침 이행).
  const [disState, setDisState] = useState<'idle' | 'loading'>('idle');
  const disconnect = async () => {
    if (
      !window.confirm(
        '인스타그램 연결을 해제할까요? 저장된 액세스 토큰이 삭제되고 답장 수신이 중지됩니다.',
      )
    ) {
      return;
    }
    setDisState('loading');
    try {
      const res = await fetch('/api/instagram/disconnect', { method: 'POST' });
      if (res.ok) setStatus((s) => (s ? { ...s, connected: false, username: null } : s));
    } finally {
      setDisState('idle');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs leading-relaxed">
        인스타 프로페셔널 계정을 연결하면, 셀럽이 DM에 답장할 때{' '}
        <span className="text-foreground font-medium">받은 답장</span> 메뉴로 자동으로 들어와요.
        (인스타에 직접 들어가지 않아도 확인·답장 가능)
      </p>

      {flag === 'connected' ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle2 className="size-4" />
          인스타그램이 연결됐어요.
        </p>
      ) : flag === 'fail' || flag === 'login' || flag === 'unavailable' ? (
        <p className="text-destructive text-sm">연결에 실패했어요. 다시 시도해 주세요.</p>
      ) : null}

      {!status ? (
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
      ) : !status.configured ? (
        <p className="text-muted-foreground text-sm">
          관리자가 인스타 앱(Meta)을 설정하면 연결할 수 있어요.
        </p>
      ) : status.connected ? (
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-sm">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
              {status.username ? `@${status.username}` : ''} 연결됨
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resubscribe}
              disabled={subState === 'loading'}
            >
              {subState === 'loading' ? '재연결 중…' : '답장 수신 재연결'}
            </Button>
            {subState === 'ok' ? (
              <span className="text-xs text-emerald-600">답장 수신이 켜졌어요.</span>
            ) : subState === 'error' ? (
              <span className="text-destructive text-xs">
                재연결 실패 — 잠시 후 다시 시도해 주세요.
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={disconnect}
              disabled={disState === 'loading'}
              className="text-muted-foreground hover:text-destructive"
            >
              {disState === 'loading' ? '해제 중…' : '연결 해제'}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            답장이 안 들어오면 위{' '}
            <span className="text-foreground font-medium">답장 수신 재연결</span>을 눌러 주세요.
            (인스타 웹훅 구독을 다시 겁니다)
          </p>
        </div>
      ) : (
        <Button type="button" onClick={() => (window.location.href = '/api/instagram/authorize')}>
          <Instagram className="size-4" />
          인스타그램 연결
        </Button>
      )}
    </div>
  );
}
