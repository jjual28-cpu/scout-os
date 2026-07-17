import Link from 'next/link';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Icon-chip accent colors for KPI tiles. */
export type StatAccent = 'primary' | 'blue' | 'emerald' | 'amber' | 'fuchsia' | 'rose';
const STAT_ACCENTS: Record<StatAccent, string> = {
  primary: 'bg-[#7c3aed] text-white',
  blue: 'bg-[#2b7fff] text-white',
  emerald: 'bg-[#10b981] text-white',
  amber: 'bg-[#f59e0b] text-white',
  fuchsia: 'bg-[#ec4899] text-white',
  rose: 'bg-[#f43f5e] text-white',
};

/** A KPI tile: icon in a colored chip, label, big number. Delta is optional —
 *  omit when there's no real comparison data (never fabricate one). When `href`
 *  is set the whole card is a link (not just the number). */
export function StatCard({
  icon,
  label,
  value,
  accent,
  delta,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  /** Icon-chip color. Omit for a neutral slate chip. */
  accent?: StatAccent;
  delta?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl',
            accent
              ? STAT_ACCENTS[accent]
              : 'dark:bg-muted dark:text-muted-foreground bg-slate-100 text-slate-500',
          )}
        >
          {icon}
        </span>
        <span className="text-muted-foreground text-[13px] font-medium">{label}</span>
      </div>
      <div className="mt-3.5 flex items-end gap-2">
        <p className="text-[30px] font-semibold tabular-nums leading-none tracking-tight">
          {value}
        </p>
        {delta ? <span className="pb-0.5 text-xs">{delta}</span> : null}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="bg-card hover:border-primary/40 block rounded-2xl border p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm"
      >
        {body}
      </Link>
    );
  }
  return <div className="bg-card rounded-2xl border p-5">{body}</div>;
}

/** A titled card section with an optional right-aligned action slot. */
export function SectionCard({
  title,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('bg-card rounded-xl border p-6', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {action ?? null}
      </div>
      <div className={cn('mt-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Soft pastel status pill. `tone` picks the semantic color; default is neutral slate. */
export function StatusBadge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'primary' | 'emerald' | 'amber' | 'blue' | 'rose' | 'indigo' | 'fuchsia';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    indigo: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    fuchsia: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400',
  };
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A friendly empty state with icon, message, and optional CTA. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="bg-muted text-muted-foreground mb-3 flex size-11 items-center justify-center rounded-xl">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
