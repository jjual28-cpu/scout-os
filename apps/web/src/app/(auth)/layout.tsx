import Link from 'next/link';
import { Radar, Sparkles, KanbanSquare } from 'lucide-react';

const highlights = [
  { icon: Radar, text: '브랜드에 딱 맞는 셀럽을 AI가 발견' },
  { icon: Sparkles, text: '상품 분석 기반 맞춤 키워드 추천' },
  { icon: KanbanSquare, text: 'DM 작성부터 협업·성과 관리까지 한 곳에서' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — hidden on small screens */}
      <div className="bg-primary text-primary-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Ambient gradient glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(60% 60% at 20% 10%, rgba(255,255,255,0.25) 0%, transparent 60%), radial-gradient(50% 50% at 90% 80%, rgba(255,255,255,0.18) 0%, transparent 60%)',
          }}
        />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
              <span className="text-sm font-bold">S</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">Scout OS</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-balance text-3xl font-bold leading-tight">
            당신의 브랜드에 딱 맞는 셀럽을 찾다
          </h2>
          <p className="text-primary-foreground/80 mt-4 text-pretty">
            AI가 브랜드와 상품에 맞는 셀럽을 발견합니다. 검색부터 DM, 협업 관리까지 한곳에서.
          </p>

          <ul className="mt-8 space-y-4">
            {highlights.map((h) => {
              const Icon = h.icon;
              return (
                <li key={h.text} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-primary-foreground/90 text-sm">{h.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-primary-foreground/60 relative z-10 text-xs">
          © {new Date().getFullYear()} Scout OS · Early access
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* Mobile brand mark */}
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
              <span className="text-sm font-bold">S</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">Scout OS</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
