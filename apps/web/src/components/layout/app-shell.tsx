'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

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
      {/* Desktop sidebar */}
      <aside className="dark:border-border dark:bg-card hidden w-[248px] shrink-0 border-r border-slate-200/60 bg-white md:block">
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
          className="bg-card absolute inset-y-0 left-0 w-64 border-r shadow-xl"
          style={{ transform: open ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          <AppSidebar onNavigate={() => setOpen(false)} />
        </div>
      </div>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onOpenMenu={() => setOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
