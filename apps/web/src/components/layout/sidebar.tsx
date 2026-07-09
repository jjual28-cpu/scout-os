'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { mainNav } from '@/config/site';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-card hidden w-64 shrink-0 border-r md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
          <span className="text-sm font-bold">S</span>
        </div>
        <span className="text-lg font-semibold tracking-tight">Scout OS</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {mainNav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="text-muted-foreground border-t p-4 text-xs">
        <p className="text-foreground font-medium">기회를 먼저 발견하는 AI 직원</p>
        <p className="mt-1">v0.1.0 · early access</p>
      </div>
    </aside>
  );
}
