import { Sparkles } from 'lucide-react';

import { DISCOVER_CATEGORIES } from '../discover-mock';
import { DiscoverCard } from './discover-card';

/**
 * "Today's Opportunities" — the daily-discovery home. A scannable, premium feed
 * of what Scout OS surfaced today, grouped by category. Mock data only.
 * This is the screen users open every morning; Discover, not a dashboard, is
 * the main entry point of Scout OS.
 */
export function DailyDiscovery() {
  const total = DISCOVER_CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-2">
        <div className="bg-primary/5 text-primary mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
          <Sparkles className="size-3.5" />
          Daily Discovery
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Today&apos;s Opportunities
        </h1>
        <p className="text-muted-foreground mt-2">
          오늘 Scout OS가 새로 발견한 기회 {total}건 — 매일 아침, 먼저 확인하세요.
        </p>
      </header>

      {DISCOVER_CATEGORIES.map((category) => (
        <section key={category.type} className="mt-10">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{category.label}</h2>
            <span className="bg-muted text-muted-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium">
              {category.items.length}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {category.items.map((item) => (
              <DiscoverCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
