'use client';

import {
  BarChart3,
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

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/features/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { cn } from '@/lib/utils';

import { useCurrentUser } from './use-current-user';

type NavItem = { title: string; href: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { title: 'Dashboard', href: '/home', icon: LayoutDashboard },
  { title: 'Discover', href: '/discover', icon: Compass },
  { title: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { title: 'CRM', href: '/crm', icon: KanbanSquare },
  { title: 'Products', href: '/products', icon: Package },
];

// Not yet built — shown disabled with a "준비 중" badge (never a broken link).
const SOON: { title: string; icon: LucideIcon }[] = [
  { title: 'AI Engine', icon: Sparkles },
  { title: 'Reports', icon: BarChart3 },
  { title: 'Settings', icon: Settings },
];

/** Sidebar content column — placed by AppShell into both the desktop rail and the
 *  mobile drawer. `onNavigate` lets the mobile drawer close on selection. */
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { email, name } = useCurrentUser();

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
              <div
                key={item.title}
                aria-disabled
                className="dark:text-muted-foreground/50 flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400"
              >
                <Icon className="size-[18px] shrink-0" />
                <span className="flex-1 truncate">{item.title}</span>
                <span className="dark:bg-muted dark:text-muted-foreground/70 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                  준비 중
                </span>
              </div>
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
    </div>
  );
}
