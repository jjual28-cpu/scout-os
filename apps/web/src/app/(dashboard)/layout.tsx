import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
// import { createClient } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // When auth is wired up, resolve the current user here and pass it down.
  // const supabase = createClient();
  // const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="bg-muted/30 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
