import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { AppProviders } from '@/providers';
import { siteConfig } from '@/config/site';

import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — AI 셀럽 디스커버리 플랫폼`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  // 링크 공유 미리보기(카카오톡·트위터 등). og:image 는 app/opengraph-image.tsx 가
  // 자동 연결한다. type/locale/카드형만 지정 — 제목·설명은 각 라우트 metadata 상속.
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    locale: 'ko_KR',
    url: siteConfig.url,
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1120' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Pretendard — 프리미엄 무료 한글 폰트(윤고딕/애플 SD산돌고딕 계열). variable woff2, CDN 캐시. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <GoogleAnalytics />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
