import {
  ArrowRight,
  BarChart3,
  Check,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Target,
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

        <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
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
