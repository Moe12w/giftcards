'use client';

import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Percent,
  ScanLine,
  ScrollText,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Tag,
  Ticket,
  Upload,
  UserRound,
  Users,
  Warehouse,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { signOut } from '@/lib/actions/auth';

const icons: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  products: Package,
  orders: ShoppingBag,
  vouchers: Ticket,
  redeem: ScanLine,
  staff: Users,
  analytics: BarChart3,
  settings: Settings,
  onboarding: ClipboardList,
  inventory: Warehouse,
  import: Upload,
  reports: FileBarChart,
  vendors: Store,
  customers: UserRound,
  enterprise: Building2,
  promotions: Percent,
  support: LifeBuoy,
  audit: ScrollText,
  catalogue: Boxes,
  finance: CreditCard,
  tags: Tag,
  controls: SlidersHorizontal,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof icons | string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export function DashShell({
  portalLabel,
  workspaceName,
  workspaceMeta,
  userName,
  userEmail,
  userInitials,
  accent,
  nav,
  workspaceSwitcher,
  topRight,
  children,
}: {
  portalLabel: string;
  workspaceName: string;
  workspaceMeta?: string;
  userName: string;
  userEmail: string;
  userInitials: string;
  accent: 'mint' | 'lavender' | 'coral';
  nav: NavGroup[];
  workspaceSwitcher?: ReactNode;
  topRight?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const homeHref = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`;

  function active(href: string) {
    const segments = href.split('/').filter(Boolean);
    if (segments.length <= 1) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="dash">
      <aside className="dash-side">
        <Logo href={homeHref} />
        <div className="dash-workspace">
          <span className="label">{portalLabel}</span>
          <strong>{workspaceName}</strong>
          {workspaceMeta ? <span className="small muted">{workspaceMeta}</span> : null}
          {workspaceSwitcher}
        </div>
        <nav className="dash-nav" aria-label={portalLabel}>
          {nav.map((group) => (
            <Fragment key={group.label}>
              <span className="group-label">{group.label}</span>
              {group.items.map((item) => {
                const Icon = icons[item.icon] ?? LayoutDashboard;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${active(item.href) ? 'active' : ''} ${active(item.href) ? accent : ''}`}
                    aria-current={active(item.href) ? 'page' : undefined}
                  >
                    <Icon size={17} /> {item.label}
                  </Link>
                );
              })}
            </Fragment>
          ))}
        </nav>
        <div className="dash-user">
          <div className="who">
            <span className="avatar">{userInitials}</span>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: '0.88rem', lineHeight: 1.2 }}>
                {userName}
              </strong>
              <span className="small muted" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userEmail}
              </span>
            </div>
          </div>
          <form action={signOut}>
            <button className="btn sm ghost block" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="dash-main">
        <header className="dash-top">
          <div className="title">
            <span>{portalLabel}</span>
            <strong>{workspaceName}</strong>
          </div>
          <div className="btn-row">{topRight}</div>
        </header>
        {children}
      </div>
    </div>
  );
}
