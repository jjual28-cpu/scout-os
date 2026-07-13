import { ProductsPage } from '@/features/products';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '상품',
  description: '브랜드 상품을 등록하고 관리합니다. AI가 이 데이터로 추천합니다.',
};

export default function Products() {
  return <ProductsPage />;
}
