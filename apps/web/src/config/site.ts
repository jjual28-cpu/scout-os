import {
  Search,
  Radar,
  Users,
  Sparkles,
  KanbanSquare,
  Megaphone,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export const siteConfig = {
  name: 'Scout OS',
  description:
    'Scout OS is an AI employee that discovers business opportunities before you do — finding creators, brands, and sellers, then managing the collaboration end to end.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
} as const;

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

/** Primary sidebar navigation. Add feature routes here as they ship. */
export const mainNav: NavItem[] = [
  { title: 'Search', href: '/search', icon: Search, description: '기회 검색' },
  { title: 'Discovery', href: '/discovery', icon: Radar, description: '크리에이터 발굴' },
  { title: 'Creators', href: '/creators', icon: Users, description: '발굴한 대상 관리' },
  { title: 'AI Analysis', href: '/analysis', icon: Sparkles, description: 'AI 적합도 분석' },
  { title: 'CRM Pipeline', href: '/crm', icon: KanbanSquare, description: '협업 진행 현황' },
  { title: 'Campaigns', href: '/campaigns', icon: Megaphone, description: '캠페인 관리' },
  { title: 'Settings', href: '/settings', icon: Settings, description: '워크스페이스 설정' },
];
