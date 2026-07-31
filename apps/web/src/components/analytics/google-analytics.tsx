'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect, useRef } from 'react';

import { GA_ID, track } from '@/lib/analytics';

/**
 * GA4 / 구글 태그(gtag.js) 로더. `NEXT_PUBLIC_GA_ID` 있을 때만 스크립트를 넣는다.
 * 최초 page_view 는 gtag config 가 자동 전송하고, SPA 라우트 변경분만 수동 전송한다
 * (중복 방지). 루트 레이아웃에 1회 마운트.
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!GA_ID) return;
    // 최초 렌더는 gtag config 의 자동 page_view 가 담당 → 이후 이동만 전송.
    if (first.current) {
      first.current = false;
      return;
    }
    track('page_view', { page_path: pathname });
  }, [pathname]);

  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
