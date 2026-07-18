/**
 * 사업자 정보 — 결제(PG) 심사·전자상거래법 표기용.
 *
 * ⚠️ 여기 값은 전부 실제 값으로 채워야 합니다. 지금은 플레이스홀더예요.
 *    지어낸 사업자번호를 그대로 배포하면 안 됩니다. 오너가 실제 값을 넣으세요.
 *    (env 로 빼도 되지만, 공개 표기 정보라 코드 상수로 둡니다.)
 */
export const BUSINESS = {
  serviceName: 'Scout OS',
  /** 상호 (사업자등록증상 상호명) */
  companyName: '(상호를 입력하세요)',
  /** 대표자 성명 */
  ceo: '(대표자명)',
  /** 사업자등록번호 000-00-00000 */
  bizRegNo: '(사업자등록번호)',
  /** 통신판매업 신고번호 (제0000-지역-0000호) */
  mailOrderNo: '(통신판매업 신고번호)',
  /** 사업장 주소 */
  address: '(사업장 주소)',
  /** 고객센터 전화 */
  phone: '(고객센터 전화)',
  /** 고객 문의 이메일 */
  email: 'support@example.com',
  /** 개인정보 보호책임자 */
  privacyOfficer: '(개인정보 보호책임자명)',
  /** 약관·정책 최종 개정일 */
  updatedAt: '2026-07-18',
} as const;

/** 표기용 라벨/값 쌍 (푸터·사업자정보 페이지에서 재사용). */
export const BUSINESS_ROWS: { label: string; value: string }[] = [
  { label: '상호', value: BUSINESS.companyName },
  { label: '대표자', value: BUSINESS.ceo },
  { label: '사업자등록번호', value: BUSINESS.bizRegNo },
  { label: '통신판매업 신고번호', value: BUSINESS.mailOrderNo },
  { label: '사업장 주소', value: BUSINESS.address },
  { label: '고객센터', value: BUSINESS.phone },
  { label: '이메일', value: BUSINESS.email },
];
