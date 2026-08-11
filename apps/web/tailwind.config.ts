import scoutPreset from '@scout-os/config/tailwind/base';

import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [scoutPreset],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // 전역 기본 글꼴 → Pretendard (layout.tsx 에서 CDN 로드). 라틴/한글 모두 커버.
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          '"Helvetica Neue"',
          '"Segoe UI"',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          '"Malgun Gothic"',
          'sans-serif',
        ],
      },
      keyframes: {
        // 히어로 배경 오로라 글로우가 천천히 떠다니는 느낌.
        aurora: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)', opacity: '0.9' },
          '50%': { transform: 'translate3d(3%,-2%,0) scale(1.08)', opacity: '1' },
        },
        // 제품 프리뷰가 부드럽게 위아래로 부유.
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        // 키워드/후기 무한 가로 스크롤(마퀴).
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        // 그라데이션 텍스트가 흐르듯 이동.
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        // 스크롤 진입 시 아래에서 살짝 떠오르며 페이드인.
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // 배지·글로우 은은한 맥동.
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.65' },
        },
      },
      animation: {
        aurora: 'aurora 14s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        marquee: 'marquee 32s linear infinite',
        'marquee-slow': 'marquee 60s linear infinite',
        'gradient-x': 'gradient-x 6s ease-in-out infinite',
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both',
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
      },
    },
  },
};

export default config;
