'use client';

import { Bell, Menu } from 'lucide-react';
import Link from 'next/link';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

import { useCurrentUser } from './use-current-user';

/** Slim global top bar inside the content column: mobile menu trigger on the left,
 *  notification placeholder + theme toggle + avatar on the right. Page title,
 *  description and CTA live in each page's PageHeader. */
export function AppHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { name, email } = useCurrentUser();
  const initials = (name ?? email ?? 'SC').slice(0, 2).toUpperCase();

  return (
    <header className="dark:bg-background/80 dark:border-border sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200/60 bg-white/80 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="메뉴 열기"
        className="text-muted-foreground hover:text-foreground hover:bg-muted -ml-1 rounded-md p-2 transition-colors md:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex-1" />

      <button
        type="button"
        aria-label="알림 (준비 중)"
        aria-disabled
        className="text-muted-foreground/60 relative cursor-default rounded-md p-2"
      >
        <Bell className="size-[18px]" />
      </button>
      <ThemeToggle />
      <Link
        href="/account"
        aria-label="마이페이지"
        className="focus-visible:ring-ring rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
      >
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </Link>
    </header>
  );
}
