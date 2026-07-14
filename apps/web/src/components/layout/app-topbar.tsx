'use client';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useAuth } from '@/features/auth';
import { useSavedOpportunities } from '@/features/search';
import { isSupabaseConfigured } from '@/lib/env';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/home', label: '홈' },
  { href: '/discover', label: '검색' },
  { href: '/campaigns', label: '캠페인' },
  { href: '/products', label: 'Products' },
  { href: '/crm', label: 'CRM' },
  { href: '/saved', label: '저장한 기회' },
  { href: '/outreach', label: '연락 준비' },
] as const;

/**
 * Minimal, focused chrome shared by the Search and Saved screens. No sidebar —
 * search is the product's center of gravity. Shows a live saved-count badge.
 */
export function AppTopbar() {
  const pathname = usePathname();
  const { saved, count, hydrated } = useSavedOpportunities();
  const { signOut } = useAuth();
  const contactCount = saved.filter((s) => s.status === '연락예정').length;

  const badgeFor = (href: string): number | null => {
    if (!hydrated) return null;
    if (href === '/saved') return count > 0 ? count : null;
    if (href === '/outreach') return contactCount > 0 ? contactCount : null;
    return null;
  };

  return (
    <header className="bg-background/80 sticky top-0 z-10 flex h-14 items-center justify-between border-b px-6 backdrop-blur">
      <div className="flex items-center gap-6">
        <Link href="/home" className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-lg">
            <span className="text-xs font-bold">S</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Scout OS</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const badge = badgeFor(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
                {badge !== null ? (
                  <span className="bg-primary text-primary-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium">
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1">
        {isSupabaseConfigured() ? (
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors"
          >
            <LogOut className="size-4" />
            로그아웃
          </button>
        ) : null}
        <ThemeToggle />
      </div>
    </header>
  );
}
