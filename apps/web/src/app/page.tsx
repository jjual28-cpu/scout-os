import {
  ArrowRight,
  BarChart3,
  Check,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  X,
} from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scout OS — 체험단·공구·협찬 셀럽을 AI로 찾고 DM까지',
  description:
    '키워드만 넣으면 AI가 우리 상품에 맞는 인스타 셀럽을 찾아드려요. 가짜 팔로워 검증, 맞춤 DM 초안, 협업 관리·성과까지. 체험단·공구 수수료 없이 직접 연락하세요.',
  keywords: [
    '체험단',
    '공동구매 셀러',
    '인스타 공구',
    '제품 협찬',
    '인플루언서 섭외',
    '셀럽 마케팅',
    '인스타 마케팅',
  ],
};

const features = [
  {
    icon: Target,
    tone: 'bg-violet-100 text-violet-600',
    title: '우리 상품 맞춤 셀럽 발굴',
    body: '키워드·상품을 AI가 분석해 체험단·공구·협찬에 맞는 인스타 셀럽을 찾아줘요.',
  },
  {
    icon: ShieldCheck,
    tone: 'bg-fuchsia-100 text-fuchsia-600',
    title: '가짜 팔로워 걸러내기',
    body: '팔로워 수만 보지 않아요. 참여율·진짜 영향력까지 AI가 검증해줘요.',
  },
  {
    icon: MessageSquare,
    tone: 'bg-sky-100 text-sky-600',
    title: '맞춤 DM · 답장까지 한 곳에서',
    body: '셀럽마다 맞춤 DM 초안을 만들고, 답장·연락 상태를 CRM으로 관리해요.',
  },
  {
    icon: BarChart3,
    tone: 'bg-emerald-100 text-emerald-600',
    title: '협업 성과 추적',
    body: '발굴 → 저장 → DM → 답변 → 협업까지 퍼널로 성과를 확인해요.',
  },
];

const platforms = [
  { name: 'Instagram', active: true },
  { name: 'YouTube', active: false },
  { name: 'TikTok', active: false },
  { name: 'Blog', active: false },
];

const steps = [
  {
    icon: Search,
    title: '1. 키워드만 입력',
    body: '“여름 뷰티”처럼 상품·키워드만 넣으면 돼요. 대행사 미팅·체험단 신청 없이.',
  },
  {
    icon: ShieldCheck,
    title: '2. AI가 발굴 · 검증',
    body: '상품에 맞는 셀럽을 찾고, 가짜 팔로워·참여율까지 걸러줘요.',
  },
  {
    icon: Send,
    title: '3. 맞춤 DM · 관리',
    body: '셀럽별 맞춤 DM 초안부터 답장·협업 관리·성과까지 한 곳에서.',
  },
];

/** 체험단·공구 대행(them) vs Scout OS(us) 비교. */
const compare = [
  { label: '비용', them: '건당 수수료 · 대행비', us: '월 구독 · 수수료 0원' },
  { label: '셀럽 선택', them: '플랫폼이 정해준 풀', us: '내 상품 맞춤 · 직접 선택' },
  { label: '진짜 영향력', them: '팔로워 수 위주', us: '참여율 · 가짜 팔로워 검증' },
  { label: '관리', them: '엑셀 · 수기 관리', us: 'DM·답장·성과 CRM 자동' },
];

const plans = [
  { name: '무료', price: '0원', unit: '', desc: '월 1회 검색 · 카드 등록 없음', highlight: false },
  { name: '베이직', price: '39,000원', unit: '/월', desc: '월 100회 검색', highlight: true },
  { name: '프로', price: '79,000원', unit: '/월', desc: '월 300회 검색', highlight: false },
];

const faqs = [
  {
    q: 'DM이 자동으로 발송되나요?',
    a: '인스타 정책상 자동 전송은 막혀 있어요. Scout OS는 맞춤 DM을 만들고 그 셀럽의 DM 창을 열어줘, 붙여넣기(Ctrl/⌘+V) 한 번이면 끝나게 도와줍니다.',
  },
  {
    q: '무료로 어디까지 되나요?',
    a: '회원가입·카드 등록 없이 월 1회 검색을 무료로 써볼 수 있어요. 마음에 들면 그때 유료로 올리면 됩니다.',
  },
  {
    q: '가짜 팔로워는 어떻게 걸러내나요?',
    a: '팔로워 수만 보지 않고 참여율·이상 신호를 AI가 분석해 “가짜 팔로워 의심”을 표시해줘요.',
  },
  {
    q: '체험단·공구 대행과 뭐가 다른가요?',
    a: '수수료 없이 내 상품에 맞는 셀럽을 직접 골라 연락하고, 성과까지 한 곳에서 관리한다는 점이 달라요.',
  },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-white text-slate-900">
      {/* ── DARK HERO ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-slate-950 pb-28 text-white">
        {/* Neon brand glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(48% 40% at 80% 4%, hsl(282 95% 62% / 0.38) 0%, transparent 60%), radial-gradient(45% 45% at 10% 18%, hsl(258 92% 62% / 0.30) 0%, transparent 55%), radial-gradient(65% 50% at 50% 108%, hsl(305 90% 60% / 0.18) 0%, transparent 60%)',
          }}
        />
        {/* Dot grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: 'radial-gradient(white 1px, transparent 1px)',
            backgroundSize: '26px 26px',
            maskImage: 'radial-gradient(70% 60% at 50% 25%, black, transparent)',
            WebkitMaskImage: 'radial-gradient(70% 60% at 50% 25%, black, transparent)',
          }}
        />

        <div className="relative mx-auto w-full max-w-6xl px-6">
          {/* Nav (dark) */}
          <header className="flex items-center justify-between py-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30">
                <span className="text-sm font-bold">S</span>
              </div>
              <span className="text-lg font-semibold tracking-tight text-white">Scout OS</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                className="text-white/80 hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">로그인</Link>
              </Button>
              <Button asChild className="bg-white text-slate-900 hover:bg-white/90">
                <Link href="/signup">무료로 시작하기</Link>
              </Button>
            </div>
          </header>

          {/* Hero */}
          <section className="grid items-center gap-12 py-14 lg:grid-cols-2 lg:gap-8 lg:py-20">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-violet-200 backdrop-blur">
                <Sparkles className="size-3.5 text-fuchsia-300" />
                체험단·공구·협찬, 이제 AI로
              </span>

              <h1 className="mt-6 text-balance text-[2.7rem] font-bold leading-[1.08] tracking-tight text-white sm:text-[3.6rem]">
                체험단·공구 대신,
                <br />
                AI가 찾은{' '}
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                  셀럽
                </span>
                에게
                <br />
                직접 DM 보내세요.
              </h1>

              <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-slate-300">
                키워드만 넣으면 AI가 우리 상품에 맞는 인스타 셀럽을 찾아드려요. 맞춤 DM 초안부터
                답장·협업 관리, 성과까지 한 곳에서 — 체험단·공구 수수료 없이.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-xl shadow-fuchsia-500/30 hover:opacity-95"
                >
                  <Link href="/signup">
                    무료로 시작하기 <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/login">로그인</Link>
                </Button>
              </div>

              <ul className="mt-7 flex flex-wrap gap-2 text-sm">
                {['회원가입 무료', '카드 등록 없음', '바로 사용 가능'].map((t) => (
                  <li
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300"
                  >
                    <Check className="size-4 text-fuchsia-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Product preview — neon glow + tilt + floating feature chips */}
            <div className="relative">
              <div
                aria-hidden
                className="absolute -inset-10 rounded-[3rem] bg-gradient-to-tr from-violet-600/45 via-fuchsia-600/35 to-pink-500/35 blur-3xl"
              />
              <div className="relative rotate-[1.5deg] transition-transform duration-500 hover:rotate-0">
                <HeroPreview />
              </div>
              <div className="absolute -left-3 top-10 hidden items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 shadow-xl sm:flex">
                <TriangleAlert className="size-3.5" />
                가짜 팔로워 의심
              </div>
              <div className="absolute -right-2 bottom-14 hidden items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-600 shadow-xl sm:flex">
                <Sparkles className="size-3.5" />
                AI 추천 · 적합도 92
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ── LIGHT CONTENT (feature cards rise over the dark→light seam) ── */}
      <div className="relative mx-auto w-full max-w-6xl px-6">
        {/* Feature cards */}
        <section className="relative z-10 -mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-500/[0.07]"
              >
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110',
                    f.tone,
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
              </div>
            );
          })}
        </section>

        {/* How it works — tinted panel */}
        <section className="py-14">
          <div className="rounded-[2rem] bg-gradient-to-b from-violet-50/70 to-white p-8 ring-1 ring-violet-100/70 sm:p-12">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              3단계면 끝나요
            </h2>
            <p className="mt-2 text-center text-slate-600">
              체험단 신청·대행사 미팅 없이, 오늘 바로 시작하세요.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {steps.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.title}
                    className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mt-4 font-semibold">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* ── DARK ACCENT: comparison (full-bleed) ─────────────────── */}
      <div className="relative overflow-hidden bg-slate-950 py-20 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(45% 55% at 15% 10%, hsl(258 92% 62% / 0.28) 0%, transparent 55%), radial-gradient(45% 55% at 85% 90%, hsl(300 90% 60% / 0.24) 0%, transparent 55%)',
          }}
        />
        <div className="relative mx-auto w-full max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
            체험단·공구와 뭐가 다른가요?
          </h2>
          <p className="mt-3 text-center text-slate-400">
            수수료 없이, 진짜 영향력 있는 셀럽을 직접 골라 연락하세요.
          </p>
          <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur">
            <div className="grid grid-cols-3 text-sm font-semibold">
              <div className="p-4 text-slate-500"> </div>
              <div className="p-4 text-center text-slate-400">체험단·공구 대행</div>
              <div className="bg-gradient-to-b from-violet-500 to-fuchsia-500 p-4 text-center text-white shadow-lg shadow-fuchsia-500/30">
                Scout OS
              </div>
            </div>
            {compare.map((row) => (
              <div key={row.label} className="grid grid-cols-3 border-t border-white/10 text-sm">
                <div className="p-4 font-medium text-white">{row.label}</div>
                <div className="flex items-center gap-1.5 p-4 text-slate-500">
                  <X className="size-4 shrink-0 text-slate-600" />
                  {row.them}
                </div>
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 p-4 font-medium text-white">
                  <Check className="size-4 shrink-0 text-fuchsia-400" />
                  {row.us}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* reopen light container */}
      <div className="relative mx-auto w-full max-w-6xl px-6">
        {/* Pricing — tinted panel, elevated 인기 plan */}
        <section id="pricing" className="py-14">
          <div className="rounded-[2rem] bg-gradient-to-b from-slate-50 to-white p-8 ring-1 ring-slate-100 sm:p-12">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              합리적인 가격
            </h2>
            <p className="mt-2 text-center text-slate-600">
              부담 없이 무료로 써보고, 필요하면 그때 올리세요. 연간 결제 시 2개월 무료.
            </p>
            <div className="mx-auto mt-10 grid max-w-3xl items-center gap-5 sm:grid-cols-3">
              {plans.map((p) => (
                <div
                  key={p.name}
                  className={cn(
                    'rounded-2xl border bg-white p-6 transition-all',
                    p.highlight
                      ? 'border-violet-300 shadow-xl shadow-violet-500/10 ring-1 ring-violet-200 sm:-translate-y-2'
                      : 'border-slate-200/70 shadow-sm',
                  )}
                >
                  {p.highlight ? (
                    <span className="inline-block rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      인기
                    </span>
                  ) : null}
                  <p className="mt-2 font-semibold">{p.name}</p>
                  <p className="mt-1">
                    <span className="text-2xl font-bold tracking-tight">{p.price}</span>
                    <span className="text-sm text-slate-500">{p.unit}</span>
                  </p>
                  <p className="mt-1.5 text-sm text-slate-600">{p.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button asChild size="lg" className="shadow-lg shadow-violet-500/25">
                <Link href="/signup">
                  무료로 시작하기 <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-14">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            자주 묻는 질문
          </h2>
          <div className="mx-auto mt-10 max-w-2xl space-y-3">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm transition-colors open:border-violet-200 [&_summary]:cursor-pointer"
              >
                <summary className="flex items-center justify-between font-medium">
                  {f.q}
                  <span className="text-violet-400 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Platforms */}
        <section className="py-10">
          <p className="text-center text-sm text-slate-500">지원 플랫폼</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {platforms.map((p) => (
              <span
                key={p.name}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm',
                  p.active
                    ? 'border-violet-200 bg-white font-medium text-slate-900 shadow-sm'
                    : 'border-slate-200 text-slate-400',
                )}
              >
                {p.name}
                {!p.active ? (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                    지원 예정
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </section>

        {/* Final CTA — bold gradient band */}
        <section className="py-16">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-500 px-6 py-16 text-center shadow-2xl shadow-violet-500/30">
            <div
              aria-hidden
              className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
            />
            <div
              aria-hidden
              className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-2xl"
            />
            <h2 className="relative text-2xl font-bold tracking-tight text-white sm:text-3xl">
              지금 무료로 셀럽을 찾아보세요
            </h2>
            <p className="relative mt-3 text-violet-100">
              회원가입 무료 · 카드 등록 없음 · 1분이면 시작
            </p>
            <Button
              asChild
              size="lg"
              className="relative mt-6 bg-white text-violet-700 shadow-lg hover:bg-violet-50"
            >
              <Link href="/signup">
                무료로 시작하기 <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
          <div className="mb-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
            <Link href="/terms" className="hover:text-slate-600">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-slate-600">
              개인정보처리방침
            </Link>
            <Link href="/refund" className="hover:text-slate-600">
              환불정책
            </Link>
            <Link href="/business" className="hover:text-slate-600">
              사업자정보
            </Link>
          </div>
          © {new Date().getFullYear()} Scout OS · AI 셀럽 발굴 · 체험단·공구·협찬 아웃리치
        </footer>
      </div>
    </main>
  );
}

/** A stylized, non-interactive HTML mockup of the Scout OS dashboard for the hero. */
function HeroPreview() {
  const kpis = [
    { label: '진행 중 캠페인', value: '8' },
    { label: '발견한 셀럽', value: '214' },
    { label: 'DM 발송', value: '46' },
    { label: '답변율', value: '32%' },
  ];
  const campaigns = [
    { name: '여름 뷰티 공구', creators: 24, label: '진행중', tone: 'emerald' },
    { name: '캠핑 브랜드 협업', creators: 12, label: '완료', tone: 'blue' },
    { name: '반려동물 인플루언서', creators: 31, label: '보류', tone: 'amber' },
  ] as const;
  const tone: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div
      aria-hidden
      className="pointer-events-none select-none overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/[0.12] ring-1 ring-slate-900/5"
    >
      <div className="flex">
        {/* Mini sidebar */}
        <div className="hidden w-32 shrink-0 border-r border-slate-100 bg-slate-50/60 p-3 sm:block">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-violet-600 to-fuchsia-500 text-[10px] font-bold text-white">
              S
            </div>
            <span className="text-xs font-semibold">Scout OS</span>
          </div>
          <div className="mt-4 space-y-1">
            {['Dashboard', 'Discover', 'Campaigns', 'CRM', 'Products'].map((n, i) => (
              <div
                key={n}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px]',
                  i === 0 ? 'bg-violet-100 font-medium text-violet-700' : 'text-slate-400',
                )}
              >
                {n}
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold">대시보드</p>
              <p className="text-[10px] text-slate-400">오늘도 좋은 셀럽을 발견해보세요</p>
            </div>
            <div className="rounded-md bg-gradient-to-r from-violet-600 to-fuchsia-500 px-2 py-1 text-[10px] font-medium text-white">
              + 새 캠페인
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-lg border border-slate-100 p-2.5">
                <p className="text-[10px] text-slate-400">{k.label}</p>
                <p className="mt-0.5 text-lg font-semibold tracking-tight">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-slate-100">
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold">
              최근 캠페인
            </p>
            <div className="divide-y divide-slate-50">
              {campaigns.map((c) => (
                <div key={c.name} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium">{c.name}</p>
                    <p className="text-[10px] text-slate-400">셀럽 {c.creators}명</p>
                  </div>
                  <span
                    className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', tone[c.tone])}
                  >
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
