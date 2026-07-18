import Link from 'next/link';

import { BUSINESS, BUSINESS_ROWS } from '../business';

const LINKS = [
  { href: '/terms', label: '이용약관' },
  { href: '/privacy', label: '개인정보처리방침' },
  { href: '/refund', label: '환불정책' },
  { href: '/business', label: '사업자정보' },
];

/** Standalone document layout for the public legal pages (no app sidebar). */
export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md text-[12px] font-bold">
              S
            </span>
            <span className="text-sm font-semibold tracking-tight">Scout OS</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">최종 개정일 {BUSINESS.updatedAt}</p>
        <div className="mt-8 space-y-8 text-[15px] leading-relaxed">{children}</div>
      </main>

      <footer className="mt-8 border-t">
        <div className="text-muted-foreground mx-auto max-w-3xl px-5 py-8 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {BUSINESS_ROWS.map((r) => (
              <div key={r.label} className="flex gap-2">
                <dt className="shrink-0">{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4">
            © {new Date().getFullYear()} {BUSINESS.serviceName}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

/** A titled section used inside legal documents. */
export function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="text-foreground/90 mt-2 space-y-2">{children}</div>
    </section>
  );
}
