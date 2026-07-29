'use client';

import {
  BarChart3,
  Check,
  Compass,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Send,
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
import { useInbox } from '@/features/inbox/hooks/use-inbox';
import { useOutreach } from '@/features/search/hooks/use-outreach';
import { isSupabaseConfigured } from '@/lib/env';
import { cn } from '@/lib/utils';

import { useCurrentUser } from './use-current-user';

type NavItem = { title: string; href: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { title: '대시보드', href: '/home', icon: LayoutDashboard },
  { title: 'AI 직원', href: '/ai-employee', icon: Sparkles },
  { title: '셀럽 찾기', href: '/discover', icon: Compass },
  { title: '캠페인', href: '/campaigns', icon: Megaphone },
  { title: '협업 관리', href: '/crm', icon: KanbanSquare },
  { title: 'DM 발송', href: '/dm-queue', icon: Send },
  { title: '받은 답장', href: '/inbox', icon: Inbox },
  { title: '상품', href: '/products', icon: Package },
  { title: '리포트', href: '/reports', icon: BarChart3 },
  { title: '설정', href: '/settings', icon: Settings },
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

const SOON: SoonItem[] = [];

/** Sidebar content column — placed by AppShell into both the desktop rail and the
 *  mobile drawer. `onNavigate` lets the mobile drawer close on selection. */
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { email, name } = useCurrentUser();
  const outreach = useOutreach();
  const { unreadTotal } = useInbox();
  const [soonOpen, setSoonOpen] = useState<SoonItem | null>(null);

  const initials = (name ?? email ?? 'SC').slice(0, 2).toUpperCase();

  // 사이드바 배지 — 협업관리: 오늘 후속 필요(연락완료+예정일 지남), 받은 답장: 미읽음.
  const today = new Date().toISOString().slice(0, 10);
  const dueCount = Object.values(outreach.records).filter(
    (r) => r.status === '연락완료' && r.followUpAt && r.followUpAt <= today,
  ).length;
  const badges: Record<string, number> = { '/crm': dueCount, '/inbox': unreadTotal };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Link href="/home" className="flex items-center gap-2.5" onClick={onNavigate}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8b5cf6] text-white">
            <span className="text-[13px] font-bold">S</span>
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-white">Scout OS</span>
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
                    ? 'bg-[#8b5cf6] font-medium text-white'
                    : 'text-[#c4b5f0] hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                <span className="flex-1 truncate">{item.title}</span>
                {badges[item.href] ? (
                  <span
                    className={cn(
                      'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                      item.href === '/inbox'
                        ? 'bg-rose-500 text-white'
                        : 'bg-amber-400 text-amber-950',
                    )}
                  >
                    {badges[item.href]}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className={cn('mt-6 space-y-0.5', SOON.length === 0 && 'hidden')}>
          {SOON.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => setSoonOpen(item)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#9d8ecb] transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon className="size-[18px] shrink-0" />
                <span className="flex-1 truncate text-left">{item.title}</span>
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-[#c4b5f0]">
                  준비 중
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* User / logout */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-1 px-1 py-1">
          <Link
            href="/account"
            onClick={onNavigate}
            aria-label="마이페이지"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-white/10"
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-white/15 text-[11px] text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{name ?? '내 계정'}</p>
              {email ? <p className="truncate text-xs text-[#9d8ecb]">{email}</p> : null}
            </div>
          </Link>
          {isSupabaseConfigured() ? (
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="로그아웃"
              className="rounded-md p-1.5 text-[#c4b5f0] transition-colors duration-150 hover:bg-white/10 hover:text-white"
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
