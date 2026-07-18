import { BUSINESS } from '@/features/legal/business';
import { Article, LegalShell } from '@/features/legal/components/legal-shell';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: '개인정보처리방침' };

export default function PrivacyPage() {
  return (
    <LegalShell title="개인정보처리방침">
      <Article title="1. 수집하는 개인정보 항목">
        <p>회사는 서비스 제공을 위해 아래의 개인정보를 수집합니다.</p>
        <p>· 회원 정보: 이메일 주소, 계정 식별자</p>
        <p>· 서비스 이용 정보: 검색어, 저장한 크리에이터, 아웃리치 메모·상태</p>
        <p>
          · 결제 정보: 유료 구독 시 결제대행사(토스페이먼츠)를 통해 처리되며, 회사는 카드번호 등
          결제수단 전체 정보를 저장하지 않습니다.
        </p>
        <p>· 자동 수집: 서비스 이용 기록, 접속 로그 등</p>
      </Article>

      <Article title="2. 개인정보의 이용 목적">
        <p>· 회원 식별 및 서비스 제공, 유료 구독의 결제·정산</p>
        <p>· 서비스 이용 한도 관리 및 부정 이용 방지</p>
        <p>· 고객 문의 응대 및 공지 전달</p>
      </Article>

      <Article title="3. 보유 및 이용 기간">
        <p>
          회원 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령(전자상거래법 등)에 따라 보존이 필요한
          거래·결제 기록은 해당 법령이 정한 기간 동안 보관합니다.
        </p>
      </Article>

      <Article title="4. 개인정보 처리의 위탁 및 국외 이전">
        <p>회사는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁합니다.</p>
        <p>· Supabase (데이터베이스·인증 저장, 국외)</p>
        <p>· Apify (공개 인스타그램 프로필 수집, 국외)</p>
        <p>· OpenRouter 및 이를 통한 AI 모델 제공자 (검색어 번역·적합도 판정·DM 초안 생성, 국외)</p>
        <p>· 토스페이먼츠 (결제 처리, 국내)</p>
        <p>
          위탁 시 관련 법령에 따라 개인정보가 안전하게 관리되도록 필요한 사항을 규정합니다. 검색은
          공개된 프로필 정보를 대상으로 하며, 수집 대상 크리에이터의 정보는 서비스 이용자에게 협업
          검토 목적으로 제공됩니다.
        </p>
      </Article>

      <Article title="5. 이용자의 권리">
        <p>
          이용자는 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요청할 수 있으며, 회원 탈퇴를
          통해 개인정보의 파기를 요청할 수 있습니다.
        </p>
      </Article>

      <Article title="6. 개인정보 보호책임자">
        <p>· 보호책임자: {BUSINESS.privacyOfficer}</p>
        <p>· 문의: {BUSINESS.email}</p>
      </Article>

      <Article title="7. 방침의 변경">
        <p>
          이 방침은 법령·서비스의 변경에 따라 개정될 수 있으며, 변경 시 서비스 화면을 통해
          공지합니다.
        </p>
      </Article>
    </LegalShell>
  );
}
