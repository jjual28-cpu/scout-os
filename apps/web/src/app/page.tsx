import Link from 'next/link';
import { ArrowRight, Radar, Sparkles, KanbanSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';

const pillars = [
  {
    icon: Radar,
    title: '먼저 발견합니다',
    body: '인스타그램·유튜브·틱톡·블로그에서 크리에이터, 신규 브랜드, 공구 셀러를 AI가 매일 발굴합니다.',
  },
  {
    icon: Sparkles,
    title: '분석하고 판단합니다',
    body: '적합도·성장성·리스크를 AI가 스코어링하고, 협업 각도와 제안 문구까지 제시합니다.',
  },
  {
    icon: KanbanSquare,
    title: '협업을 관리합니다',
    body: 'AI가 DM을 쓰고, 팔로업을 챙기고, 진행 현황을 CRM 파이프라인으로 관리합니다.',
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-6">
      <header className="flex w-full items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
            <span className="text-sm font-bold">S</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">Scout OS</span>
        </div>
        <Button asChild variant="ghost">
          <Link href="/login">로그인</Link>
        </Button>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-20 text-center">
        <span className="text-muted-foreground mb-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium">
          AI Business Development Employee
        </span>
        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
          사업 기회를 <span className="text-primary">먼저 발견</span>해주는 AI 직원
        </h1>
        <p className="text-muted-foreground mt-6 max-w-2xl text-balance text-lg">
          Scout OS는 단순한 인플루언서 검색기가 아닙니다. 발굴부터 분석, 협업 관리까지 — 당신이 잠든
          사이에도 기회를 찾아냅니다.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">
              무료로 시작하기 <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">로그인</Link>
          </Button>
        </div>
      </section>

      <section className="grid w-full gap-6 pb-24 sm:grid-cols-3">
        {pillars.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="bg-card rounded-xl border p-6 text-left">
              <div className="bg-primary/10 text-primary mb-4 flex h-10 w-10 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </div>
              <h3 className="font-semibold">{p.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm">{p.body}</p>
            </div>
          );
        })}
      </section>
    </main>
  );
}
