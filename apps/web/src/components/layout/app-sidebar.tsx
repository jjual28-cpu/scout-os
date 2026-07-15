'use client';

import {
  BarChart3,
  Check,
  Compass,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Sparkles,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { cn } from '@/lib/utils';

import { useCurrentUser } from './use-current-user';

type NavItem = { title: string; href: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { title: '대시보드', href: '/home', icon: LayoutDashboard },
  { title: '셀럽 찾기', href: '/discover', icon: Compass },
  { title: '캠페인', href: '/campaigns', icon: Megaphone },
  { title: '협업 관리', href: '/crm', icon: KanbanSquare },
  { title: '상품', href: '/products', icon: Package },
];

/**
 * Not yet built — clickable, but they explain the feature instead of routing.
 * `order` is the shipping queue shown in the modal; keep it in sync with the
 * roadmap so the badge and the copy never drift apart.
 */
type SoonItem = {
  title: string;
  icon: LucideIcon;
  order: number;
  summary: string;
  bullets: string[];
};

const SOON: SoonItem[] = [
  {
    title: '리포트',
    icon: BarChart3,
    order: 1,
    summary: '이미 쌓인 캠페인·DM 데이터를 기간별 성과로 보여줍니다.',
    bullets: [
      '기간별 검색 수 · 발견 셀럽 · 저장 · DM · 답변 · 협업',
      '전환율과 Top 검색어 / Top 캠페인',
      '상품별 · 캠페인별 성과 비교',
    ],
  },
  {
    title: '설정',
    icon: Settings,
    order: 2,
    summary: '검색 기본값과 브랜드 정보를 계정에 저장합니다.',
    bullets: [
      '기본 플랫폼 · 검색 결과 수 · 캐시 시간',
      '브랜드 기본 정보와 DM 기본 말투',
      '프로필 · 알림 설정',
    ],
  },
  {
    title: 'AI 직원',
    icon: Sparkles,
    order: 3,
    summary: '상품을 고르면 키워드 추천부터 DM 초안까지 이어서 만들어 줍니다.',
    bullets: [
      '상품 분석 → 추천 키워드 생성 → 캠페인 자동 생성',
      '이미 연락·답변·협업한 셀럽은 자동 제외',
      '상품에 맞춘 DM 초안 작성',
    ],
  },
];

/** Sidebar content column — placed by AppShell into both the desktop rail and the
 *  mobile drawer. `onNavigate` lets the mobile drawer close on selection. */
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { email, name } = useCurrentUser();
  const [soonOpen, setSoonOpen] = useState<SoonItem | null>(null);

  const initials = (name ?? email ?? 'SC').slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Link href="/home" className="flex items-center gap-2.5" onClick={onNavigate}>
          <div className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-lg">
            <span className="text-[13px] font-bold">S</span>
          </div>
          <span className="dark:text-foreground text-[15px] font-semibold tracking-tight text-slate-900">
            Scout OS
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'dark:text-muted-foreground dark:hover:bg-muted text-slate-600 hover:bg-slate-100',
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                <span className="flex-1 truncate">{item.title}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 space-y-0.5">
          {SOON.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => setSoonOpen(item)}
                className="dark:text-muted-foreground/60 dark:hover:bg-muted flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <Icon className="size-[18px] shrink-0" />
                <span className="flex-1 truncate text-left">{item.title}</span>
                <span className="dark:bg-muted dark:text-muted-foreground/70 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                  준비 중
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* User / logout */}
      <div className="dark:border-border border-t border-slate-200/60 p-3">
        <div className="flex items-center gap-2.5 px-2 py-1">
          <Avatar className="size-8">
            <AvatarFallback className="dark:bg-muted dark:text-muted-foreground bg-slate-100 text-[11px] text-slate-600">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="dark:text-foreground truncate text-sm font-medium text-slate-900">
              {name ?? '내 계정'}
            </p>
            {email ? (
              <p className="dark:text-muted-foreground truncate text-xs text-slate-500">{email}</p>
            ) : null}
          </div>
          {isSupabaseConfigured() ? (
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="로그아웃"
              className="dark:hover:bg-muted dark:hover:text-foreground rounded-md p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* "준비 중" menus are clickable — they explain instead of dead-ending. */}
      {soonOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setSoonOpen(null)}
            aria-hidden
          />
          <div className="bg-card relative w-full max-w-md rounded-2xl border p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                <soonOpen.icon className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">{soonOpen.title}</h2>
                  <span className="dark:bg-muted dark:text-muted-foreground rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    준비 중
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {soonOpen.summary}
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5">
              {soonOpen.bullets.map((b) => (
                <li key={b} className="text-muted-foreground flex gap-2 text-sm">
                  <Check className="text-primary mt-0.5 size-3.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="dark:border-border mt-4 rounded-lg border border-slate-200/60 px-3 py-2.5">
              <p className="dark:text-muted-foreground text-xs text-slate-500">
                구현 예정 순서{' '}
                <span className="text-foreground font-medium">
                  {soonOpen.order}번째 / 전체 {SOON.length}개
                </span>
                {' · '}
                {SOON.map((s) => s.title).join(' → ')}
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <Button onClick={() => setSoonOpen(null)}>확인</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
