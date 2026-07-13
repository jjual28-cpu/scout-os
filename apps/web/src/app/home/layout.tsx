import { AppTopbar } from '@/components/layout/app-topbar';

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppTopbar />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
