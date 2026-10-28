import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// 답장 자동확인 파이프라인 로직 테스트용 최소 설정.
// - tsconfigPaths: `@/*` alias 를 tsconfig 에서 그대로 해석
// - environment jsdom: 스토어의 window.localStorage(local 모드) 경로가 실제처럼 돈다
// - server-only: 서버 전용 모듈(검색 규칙 등)도 테스트에서 import 할 수 있게 빈 모듈로
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: { 'server-only': 'next/dist/compiled/server-only/empty.js' },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
