'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CampaignPoller } from '@/features/campaigns/components/campaign-poller';
import { ReplyReconciler } from '@/features/search/components/reply-reconciler';
import { cn } from '@/lib/utils';

import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';

/**
 * The shared application shell for all signed-in pages: a fixed left sidebar on
 * desktop, a slim top header, and a scrollable content column. On mobile the
 * sidebar collapses into a hamburger-triggered drawer. Page title/description/CTA
 * are provided per page via <PageHeader>. Auth/redirect logic is untouched.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="dark:bg-background flex min-h-screen bg-white">
      {/* Desktop sidebar — deep purple, high-contrast against the white content
          (premium two-tone shell). Uses a fixed brand color in both modes. */}
      <aside className="hidden w-[248px] shrink-0 border-r border-[#2c1a56] bg-[#3a2170] md:block">
        <div className="sticky top-0 h-screen">
          <AppSidebar />
        </div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 md:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-black/40"
          style={{ opacity: open ? 1 : 0 }}
          onClick={() => setOpen(false)}
        />
        <div
          className="absolute inset-y-0 left-0 w-64 border-r border-[#2c1a56] bg-[#3a2170] shadow-xl"
          style={{ transform: open ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          <AppSidebar onNavigate={() => setOpen(false)} />
        </div>
      </div>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onOpenMenu={() => setOpen(true)} />
        <main className="dark:bg-background flex-1 bg-[#faf9fc]">{children}</main>
      </div>

      {/* Keeps an in-flight search advancing while the user browses other menus. */}
      <CampaignPoller />
      {/* 셀럽 답장이 인박스로 들어오면 CRM 상태에 자동 반영(렌더 없음). */}
      <ReplyReconciler />
    </div>
  );
}
