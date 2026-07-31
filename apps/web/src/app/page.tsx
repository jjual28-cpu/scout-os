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
    title: '우리 상품 맞춤 셀럽 발굴',
    body: '키워드·상품을 AI가 분석해 체험단·공구·협찬에 맞는 인스타 셀럽을 찾아줘요.',
  },
  {
    icon: ShieldCheck,
    title: '가짜 팔로워 걸러내기',
    body: '팔로워 수만 보지 않아요. 참여율·진짜 영향력까지 AI가 검증해줘요.',
  },
  {
    icon: MessageSquare,
    title: '맞춤 DM · 답장까지 한 곳에서',
    body: '셀럽마다 맞춤 DM 초안을 만들고, 답장·연락 상태를 CRM으로 관리해요.',
  },
  {
    icon: BarChart3,
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
  { name: '베이직', price: '19,800원', unit: '/월', desc: '월 100회 검색', highlight: true },
  { name: '프로', price: '39,800원', unit: '/월', desc: '월 300회 검색', highlight: false },
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
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      {/* Ambient purple radial gradient (very soft) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 78% 12%, hsl(262 83% 58% / 0.10) 0%, transparent 60%), radial-gradient(45% 40% at 15% 90%, hsl(262 83% 58% / 0.06) 0%, transparent 60%)',
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-6">
        {/* Nav */}
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
              <span className="text-sm font-bold">S</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">Scout OS</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">로그인</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">무료로 시작하기</Link>
            </Button>
          </div>
        </header>

        {/* Hero */}
        <section className="grid items-center gap-12 py-16 lg:grid-cols-2 lg:gap-10 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              <Sparkles className="size-3.5 text-slate-400" />
              체험단·공구·협찬, 이제 AI로
            </span>

            <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
              체험단·공구 대신,
              <br />
              AI가 찾은 <span className="text-primary">셀럽</span>에게
              <br />
              직접 DM 보내세요.
            </h1>

            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-slate-600">
              키워드만 넣으면 AI가 우리 상품에 맞는 인스타 셀럽을 찾아드려요. 맞춤 DM 초안부터
              답장·협업 관리, 성과까지 한 곳에서 — 체험단·공구 수수료 없이.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">
                  무료로 시작하기 <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">로그인</Link>
              </Button>
            </div>

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              {['회원가입 무료', '카드 등록 없음', '바로 사용 가능'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check className="text-primary size-4" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Product preview — real HTML UI mockup, not an image */}
          <HeroPreview />
        </section>

        {/* Feature cards */}
        <section className="grid gap-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-2xl border border-slate-200/70 bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
              </div>
            );
          })}
        </section>

        {/* How it works */}
        <section className="border-t border-slate-200 py-16">
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
                <div key={s.title} className="rounded-2xl border border-slate-200/70 bg-white p-6">
                  <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-xl">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Comparison vs 체험단·공구 */}
        <section className="border-t border-slate-200 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            체험단·공구와 뭐가 다른가요?
          </h2>
          <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-3 bg-slate-50 text-sm font-semibold">
              <div className="p-4 text-slate-500"> </div>
              <div className="p-4 text-center text-slate-500">체험단·공구 대행</div>
              <div className="text-primary p-4 text-center">Scout OS</div>
            </div>
            {compare.map((row) => (
              <div key={row.label} className="grid grid-cols-3 border-t border-slate-100 text-sm">
                <div className="p-4 font-medium">{row.label}</div>
                <div className="flex items-center gap-1.5 p-4 text-slate-500">
                  <X className="size-4 shrink-0 text-slate-300" />
                  {row.them}
                </div>
                <div className="flex items-center gap-1.5 p-4 font-medium">
                  <Check className="text-primary size-4 shrink-0" />
                  {row.us}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-slate-200 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            합리적인 가격
          </h2>
          <p className="mt-2 text-center text-slate-600">
            부담 없이 무료로 써보고, 필요하면 그때 올리세요. 연간 결제 시 2개월 무료.
          </p>
          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={cn(
                  'rounded-2xl border bg-white p-6',
                  p.highlight ? 'border-primary ring-primary/20 ring-2' : 'border-slate-200/70',
                )}
              >
                {p.highlight ? (
                  <span className="bg-primary text-primary-foreground inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
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
            <Button asChild size="lg">
              <Link href="/signup">
                무료로 시작하기 <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-slate-200 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            자주 묻는 질문
          </h2>
          <div className="mx-auto mt-10 max-w-2xl space-y-3">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="rounded-xl border border-slate-200/70 bg-white p-4 [&_summary]:cursor-pointer"
              >
                <summary className="font-medium">{f.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Platforms */}
        <section className="border-t border-slate-200 py-10">
          <p className="text-center text-sm text-slate-500">지원 플랫폼</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {platforms.map((p) => (
              <span
                key={p.name}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm',
                  p.active
                    ? 'border-slate-300 bg-white font-medium text-slate-900'
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

        {/* Final CTA */}
        <section className="border-t border-slate-200 py-16">
          <div className="from-primary/10 rounded-3xl bg-gradient-to-br to-fuchsia-500/10 px-6 py-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              지금 무료로 셀럽을 찾아보세요
            </h2>
            <p className="mt-2 text-slate-600">회원가입 무료 · 카드 등록 없음 · 1분이면 시작</p>
            <Button asChild size="lg" className="mt-6">
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
      className="pointer-events-none select-none overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/[0.06]"
    >
      <div className="flex">
        {/* Mini sidebar */}
        <div className="hidden w-32 shrink-0 border-r border-slate-100 bg-slate-50/60 p-3 sm:block">
          <div className="flex items-center gap-1.5">
            <div className="bg-primary flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white">
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
                  i === 0 ? 'bg-primary/10 text-primary font-medium' : 'text-slate-400',
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
            <div className="bg-primary rounded-md px-2 py-1 text-[10px] font-medium text-white">
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
