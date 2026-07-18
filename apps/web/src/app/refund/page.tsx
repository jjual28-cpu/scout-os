import { BUSINESS } from '@/features/legal/business';
import { Article, LegalShell } from '@/features/legal/components/legal-shell';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: '환불정책' };

export default function RefundPage() {
  return (
    <LegalShell title="환불 및 취소 정책">
      <Article title="1. 유료 구독의 결제">
        <p>
          유료 구독(베이직, 프로 등)은 선택한 결제 주기(월 또는 연)에 따라 요금이 선결제되며, 해지
          전까지 매 주기 자동 갱신됩니다.
        </p>
      </Article>

      <Article title="2. 청약철회">
        <p>
          이용자는 결제일로부터 7일 이내에 청약철회를 요청할 수 있습니다. 다만 「전자상거래 등에서의
          소비자보호에 관한 법률」에 따라, 결제 후 서비스(검색·AI 기능 등)를 이미 사용한 경우 등
          디지털 콘텐츠 제공이 개시된 부분에 대해서는 청약철회가 제한될 수 있습니다.
        </p>
      </Article>

      <Article title="3. 구독 해지">
        <p>
          이용자는 언제든지 설정에서 구독을 해지할 수 있습니다. 해지 시 이미 결제된 현재 주기까지는
          서비스를 계속 이용할 수 있으며, 다음 주기부터 요금이 청구되지 않습니다. 별도 명시가 없는
          한, 이미 시작된 주기의 요금은 일할 계산하여 환불하지 않습니다.
        </p>
      </Article>

      <Article title="4. 환불 기준">
        <p>· 서비스 미사용: 결제 후 서비스를 전혀 사용하지 않은 경우 전액 환불합니다.</p>
        <p>
          · 서비스 하자·장애: 회사의 귀책으로 서비스를 정상 이용하지 못한 경우, 이용하지 못한 기간에
          상응하는 금액을 환불합니다.
        </p>
        <p>
          · 연간 구독: 이용 개시 후 중도 해지 시, 이미 사용한 기간과 이용 내역을 고려하여 관련
          법령이 정한 기준에 따라 환불액을 산정합니다.
        </p>
      </Article>

      <Article title="5. 환불 절차">
        <p>
          환불은 아래 문의처로 요청할 수 있으며, 요청 확인 후 영업일 기준 3~7일 이내에 결제한
          수단으로 환급합니다. 결제대행사·카드사의 사정에 따라 실제 환급 시점은 달라질 수 있습니다.
        </p>
      </Article>

      <Article title="6. 문의">
        <p>· 이메일: {BUSINESS.email}</p>
        <p>· 고객센터: {BUSINESS.phone}</p>
      </Article>
    </LegalShell>
  );
}
