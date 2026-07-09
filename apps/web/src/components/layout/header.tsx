import { Search } from 'lucide-react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

type HeaderProps = {
  title?: string;
  email?: string;
};

export function Header({ title, email }: HeaderProps) {
  const initials = email?.slice(0, 2).toUpperCase() ?? 'SC';

  return (
    <header className="bg-background flex h-16 shrink-0 items-center gap-4 border-b px-6">
      <div className="flex-1">
        {title ? (
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        ) : (
          <div className="relative max-w-md">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="크리에이터, 브랜드, 셀러 검색…"
              className="pl-9"
              aria-label="Global search"
            />
          </div>
        )}
      </div>

      <ThemeToggle />

      <Avatar>
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
    </header>
  );
}
