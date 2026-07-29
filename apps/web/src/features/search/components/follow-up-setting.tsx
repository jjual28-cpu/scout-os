'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import { getFollowUpDays, setFollowUpDays } from '../store/outreach-store';

const OPTIONS = [1, 3, 5, 7] as const;

/**
 * 후속(재연락) 간격 설정. 연락 완료 시 자동으로 잡히는 후속 예정일까지의 일수를
 * 고른다(기본 3일). localStorage 저장, 변경 후 새로 예약되는 후속부터 적용.
 */
export function FollowUpSetting() {
  const [days, setDays] = useState(3);
  useEffect(() => {
    setDays(getFollowUpDays());
  }, []);

  const choose = (d: number) => {
    setDays(d);
    setFollowUpDays(d);
  };

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm leading-relaxed">
        셀럽에게 연락(연락 완료)하면 이 간격 뒤로{' '}
        <span className="text-foreground font-medium">후속(재연락) 예정일</span>이 자동으로 잡혀요.
        답장이 오면 자동으로 해제됩니다.
      </p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => choose(d)}
            aria-pressed={days === d}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm transition-colors',
              days === d
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-input text-muted-foreground hover:text-foreground',
            )}
          >
            {d}일 뒤
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        현재: 연락 완료 후 <span className="text-foreground font-medium">{days}일 뒤</span> 후속
        예약
      </p>
    </div>
  );
}
