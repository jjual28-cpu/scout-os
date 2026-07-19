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
        <p className="inline-flex items-center gap-1.5 text-sm">
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
            {status.username ? `@${status.username}` : ''} 연결됨
          </span>
        </p>
      ) : (
        <Button type="button" onClick={() => (window.location.href = '/api/instagram/authorize')}>
          <Instagram className="size-4" />
          인스타그램 연결
        </Button>
      )}
    </div>
  );
}
