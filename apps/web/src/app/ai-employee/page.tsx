import { AiEmployeePage } from '@/features/ai-employee';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI 직원',
  description: '상품을 고르면 AI가 검색 키워드를 추천하고 셀럽을 찾아줍니다.',
};

export default function AiEmployee() {
  return <AiEmployeePage />;
}
