import { Send, ShieldCheck, Sparkles, Target } from 'lucide-react';
import Link from 'next/link';

const highlights = [
  { icon: Target, text: '우리 상품 맞춤 셀럽을 AI가 발굴' },
  { icon: ShieldCheck, text: '가짜 팔로워·참여율까지 AI 검증' },
  { icon: Send, text: '맞춤 DM부터 협업·성과 관리까지' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — dark hero tone, hidden on small screens */}
      <div className="relative hidden overflow-hidden bg-slate-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Neon brand glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(50% 45% at 15% 8%, hsl(258 92% 62% / 0.38) 0%, transparent 58%), radial-gradient(55% 50% at 92% 96%, hsl(300 90% 60% / 0.30) 0%, transparent 58%)',
          }}
        />
        {/* Dot grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage: 'radial-gradient(white 1px, transparent 1px)',
            backgroundSize: '26px 26px',
            maskImage: 'radial-gradient(80% 70% at 30% 30%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(80% 70% at 30% 30%, black, transparent)',
          }}
        />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">Scout OS</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-violet-200 backdrop-blur">
            <Sparkles className="size-3.5 text-fuchsia-300" />
            체험단·공구·협찬, 이제 AI로
          </span>

          <h2 className="mt-6 text-balance text-4xl font-bold leading-[1.12] tracking-tight text-white">
            체험단·공구 대신,
            <br />
            AI가 찾은{' '}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              셀럽
            </span>
            에게
            <br />
            직접 DM 보내세요.
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-slate-300">
            키워드만 넣으면 AI가 우리 상품에 맞는 인스타 셀럽을 찾아드려요. 체험단·공구 수수료 없이,
            한 곳에서.
          </p>

          <ul className="mt-8 space-y-4">
            {highlights.map((h) => {
              const Icon = h.icon;
              return (
                <li key={h.text} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-fuchsia-300">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-sm text-slate-200">{h.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} Scout OS · Early access
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* Mobile brand mark */}
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
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
