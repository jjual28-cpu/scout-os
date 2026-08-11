'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * 스크롤 진입 시 아래에서 떠오르며 페이드인하는 래퍼(모션 전용, 로직 없음).
 * IntersectionObserver 로 뷰포트 진입을 감지해 `.is-visible` 을 붙인다.
 * - framer-motion 없이 의존성 0, SSR 안전(초기엔 서버가 그냥 자식만 렌더).
 * - `delay` 로 순차 등장(스태거) 연출.
 * - 관찰이 불가능한 환경(구형/JS오류)에서도 CSS 가 opacity 0 이후 즉시 보이도록
 *   마운트 직후 한 번은 반드시 보이게 처리한다.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // IntersectionObserver 미지원 → 즉시 표시(콘텐츠가 숨겨진 채 남지 않게).
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // @ts-expect-error — 동적 태그의 ref 타입은 런타임상 안전.
      ref={ref}
      className={cn('reveal', visible && 'is-visible', className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
