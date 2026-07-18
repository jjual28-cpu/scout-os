import { BUSINESS, BUSINESS_ROWS } from '@/features/legal/business';
import { LegalShell } from '@/features/legal/components/legal-shell';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: '사업자정보' };

export default function BusinessPage() {
  return (
    <LegalShell title="사업자정보">
      <p className="text-muted-foreground">
        {BUSINESS.serviceName}는 아래 사업자가 운영합니다. (「전자상거래 등에서의 소비자보호에 관한
        법률」에 따른 표기)
      </p>
      <div className="dark:border-border overflow-hidden rounded-xl border border-slate-200">
        <dl>
          {BUSINESS_ROWS.map((r, i) => (
            <div
              key={r.label}
              className={`grid grid-cols-[8rem_1fr] gap-3 px-4 py-3 text-sm ${
                i % 2 ? 'bg-muted/40' : ''
              }`}
            >
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-muted-foreground text-sm">
        결제는 토스페이먼츠를 통해 안전하게 처리됩니다. 문의: {BUSINESS.email}
      </p>
    </LegalShell>
  );
}
