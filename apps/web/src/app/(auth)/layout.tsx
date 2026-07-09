import Link from 'next/link';
import { Radar, Sparkles, KanbanSquare } from 'lucide-react';

const highlights = [
  { icon: Radar, text: '매일 새로운 크리에이터·브랜드·셀러를 자동 발굴' },
  { icon: Sparkles, text: 'AI가 적합도·성장성·리스크를 스코어링' },
  { icon: KanbanSquare, text: 'DM 작성부터 협업 관리까지 한 곳에서' },
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
            사업 기회를 먼저 발견해주는 AI 직원
          </h2>
          <p className="text-primary-foreground/80 mt-4 text-pretty">
            잠든 사이에도 Scout OS가 기회를 찾아냅니다. 발굴부터 분석, 협업 관리까지.
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
