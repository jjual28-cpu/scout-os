import { AppTopbar } from '@/components/layout/app-topbar';

/**
 * Focused, search-first chrome. Intentionally minimal (no sidebar) so the giant
 * search input is the center of gravity — Apple/Linear "one clear job" feel.
 */
export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppTopbar />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
