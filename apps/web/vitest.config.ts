import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// 답장 자동확인 파이프라인 로직 테스트용 최소 설정.
// - tsconfigPaths: `@/*` alias 를 tsconfig 에서 그대로 해석
// - environment jsdom: 스토어의 window.localStorage(local 모드) 경로가 실제처럼 돈다
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
