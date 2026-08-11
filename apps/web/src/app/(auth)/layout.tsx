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
        {/* Neon brand glows — 천천히 떠다니는 오로라 */}
        <div
          aria-hidden
          className="animate-aurora pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(50% 45% at 15% 8%, hsl(258 92% 62% / 0.38) 0%, transparent 58%), radial-gradient(55% 50% at 92% 96%, hsl(300 90% 60% / 0.30) 0%, transparent 58%)',
          }}
        />
        {/* Floating glow orbs — 움직이는 장식 */}
        <div
          aria-hidden
          className="animate-float pointer-events-none absolute -left-16 top-24 h-56 w-56 rounded-full bg-violet-600/25 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-float pointer-events-none absolute -right-10 bottom-16 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl [animation-delay:1.4s]"
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
          <span className="animate-fade-up inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-violet-200 backdrop-blur">
            <Sparkles className="animate-pulse-soft size-3.5 text-fuchsia-300" />
            체험단·공구·협찬, 이제 AI로
          </span>

          <h2 className="animate-fade-up mt-6 text-balance text-[3.2rem] font-extrabold leading-[1.05] tracking-[-0.02em] text-white [animation-delay:80ms]">
            맞는 셀럽만,
            <br />
            <span className="animate-gradient-x bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
              AI
            </span>
            가 찾아줍니다
          </h2>
          <p className="animate-fade-up mt-5 text-pretty leading-relaxed text-slate-300 [animation-delay:160ms]">
            키워드만 넣으면 우리 상품에 맞는 인스타 셀럽을 찾아 맞춤 DM까지. 체험단·공구 수수료
            없이, 한 곳에서.
          </p>

          <ul className="mt-8 space-y-4">
            {highlights.map((h, i) => {
              const Icon = h.icon;
              return (
                <li
                  key={h.text}
                  className="animate-fade-up flex items-center gap-3"
                  style={{ animationDelay: `${240 + i * 90}ms` }}
                >
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
