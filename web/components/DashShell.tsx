'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  LifeBuoy,
  Menu,
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
  X,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { TutorialProvider, useTutorial } from '@/components/TutorialProvider';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { signOut } from '@/lib/actions/auth';
import { stepForPath, type TutorialScript } from '@/lib/tutorial';
import { pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';

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
  /** Already in the current language. */
  label: string;
  icon: keyof typeof icons | string;
  /** Shown when the pointer or keyboard focus lands on the item. */
  hint?: string;
}

export interface NavGroup {
  /** Position in the gift life cycle, shown as a number in the flow. */
  step?: number;
  /** Already in the current language. */
  label: string;
  items: NavItem[];
}

const CHROME = {
  en: {
    tutorial: 'Tutorial',
    tutorialHint: 'How the whole gift life cycle works',
    menu: 'Open the menu',
    closeMenu: 'Close the menu',
    flow: 'Gift life cycle',
    howItWorks: 'How this works',
    language: 'Language',
  },
  ar: {
    tutorial: 'الدليل',
    tutorialHint: 'كيف تعمل دورة حياة الهدية كاملة',
    menu: 'افتح القائمة',
    closeMenu: 'أغلق القائمة',
    flow: 'دورة حياة الهدية',
    howItWorks: 'كيف تعمل هذه الصفحة',
    language: 'اللغة',
  },
};

export function DashShell({
  portalLabel,
  workspaceName,
  workspaceMeta,
  workspaceLogoUrl,
  userName,
  userEmail,
  userInitials,
  accent,
  nav,
  workspaceSwitcher,
  topRight,
  tutorial,
  locale = 'en',
  autoOpenTutorial = false,
  children,
}: {
  portalLabel: string;
  workspaceName: string;
  workspaceMeta?: string;
  /** Logo of the business, shown next to its name in the menu. */
  workspaceLogoUrl?: string | null;
  userName: string;
  userEmail: string;
  userInitials: string;
  accent: 'mint' | 'lavender' | 'coral';
  nav: NavGroup[];
  workspaceSwitcher?: ReactNode;
  topRight?: ReactNode;
  tutorial?: TutorialScript;
  locale?: 'en' | 'ar';
  autoOpenTutorial?: boolean;
  children: ReactNode;
}) {
  return (
    <TutorialProvider script={tutorial ?? EMPTY_SCRIPT} locale={locale} autoOpen={autoOpenTutorial}>
      <DashShellInner
        portalLabel={portalLabel}
        workspaceName={workspaceName}
        workspaceMeta={workspaceMeta}
        workspaceLogoUrl={workspaceLogoUrl}
        userName={userName}
        userEmail={userEmail}
        userInitials={userInitials}
        accent={accent}
        nav={nav}
        workspaceSwitcher={workspaceSwitcher}
        topRight={topRight}
        locale={locale}
        script={tutorial ?? EMPTY_SCRIPT}
      >
        {children}
      </DashShellInner>
    </TutorialProvider>
  );
}

const EMPTY_SCRIPT: TutorialScript = {
  id: 'vendor',
  title: 'Tutorial',
  titleAr: 'الدليل',
  intro: '',
  introAr: '',
  steps: [],
};

function DashShellInner({
  portalLabel,
  workspaceName,
  workspaceMeta,
  workspaceLogoUrl,
  userName,
  userEmail,
  userInitials,
  accent,
  nav,
  workspaceSwitcher,
  topRight,
  locale,
  script,
  children,
}: {
  portalLabel: string;
  workspaceName: string;
  workspaceMeta?: string;
  workspaceLogoUrl?: string | null;
  userName: string;
  userEmail: string;
  userInitials: string;
  accent: 'mint' | 'lavender' | 'coral';
  nav: NavGroup[];
  workspaceSwitcher?: ReactNode;
  topRight?: ReactNode;
  locale: 'en' | 'ar';
  script: TutorialScript;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { open } = useTutorial();
  const [navOpen, setNavOpen] = useState(false);
  const rtl = locale === 'ar';
  const chrome = CHROME[locale];
  const commonCopy = pick(common, locale);
  const homeHref = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`;

  // Reset nav open state on route change (fixes iOS issue where menu stays open)
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  function active(href: string) {
    const segments = href.split('/').filter(Boolean);
    if (segments.length <= 1) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className={`dash${rtl ? ' rtl' : ''}${navOpen ? ' nav-open' : ''}`}>
      <button
        type="button"
        className="dash-scrim"
        aria-label={chrome.closeMenu}
        onClick={() => setNavOpen(false)}
        onTouchEnd={() => setNavOpen(false)}
      />
      <aside className="dash-side">
        <div className="dash-side-top">
          <Logo href={homeHref} />
        </div>
        <div className="dash-workspace">
          <span className="label">{portalLabel}</span>
          <div className="dash-workspace-name">
            {workspaceLogoUrl ? (
              <img className="dash-workspace-logo" src={workspaceLogoUrl} alt="" />
            ) : null}
            <strong>{workspaceName}</strong>
          </div>
          {workspaceMeta ? <span className="small muted">{workspaceMeta}</span> : null}
          {workspaceSwitcher}
        </div>
        <nav className="dash-nav" aria-label={portalLabel}>
          <span className="group-label flow-label">
            <span className="flow-dot" aria-hidden="true" />
            {chrome.flow}
          </span>
          {nav.map((group, groupIndex) => (
            <Fragment key={group.label}>
              {groupIndex > 0 ? (
                <span className="flow-arrow" aria-hidden="true">
                  <ChevronDown size={15} />
                </span>
              ) : null}
              <span className="group-label">
                {group.step ? <span className="group-step">{group.step}</span> : null}
                {group.label}
              </span>
              {group.items.map((item) => {
                const Icon = icons[item.icon] ?? LayoutDashboard;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${active(item.href) ? 'active' : ''} ${active(item.href) ? accent : ''}`}
                    aria-current={active(item.href) ? 'page' : undefined}
                    title={item.label}
                  >
                    <Icon size={17} />
                    <span className="nav-text">
                      <span className="nav-label">{item.label}</span>
                      {item.hint ? <span className="nav-hint">{item.hint}</span> : null}
                    </span>
                  </Link>
                );
              })}
            </Fragment>
          ))}
        </nav>
        <div className="dash-user">
          <button type="button" className="tut-launch" onClick={() => open()}>
            <span className="tut-launch-icon">
              <BookOpen size={16} />
            </span>
            <span>
              <strong>{chrome.tutorial}</strong>
              <span className="small muted">{chrome.tutorialHint}</span>
            </span>
          </button>
          <LanguageSwitch />
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
              {commonCopy.actions.signOut}
            </button>
          </form>
        </div>
      </aside>
      <div className="dash-main">
        <header className="dash-top">
          <button
            type="button"
            className="dash-menu-button"
            aria-label={chrome.menu}
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="title">
            <span>{portalLabel}</span>
            <span className="dash-top-name">
              {workspaceLogoUrl ? (
                <img className="dash-top-logo" src={workspaceLogoUrl} alt="" />
              ) : null}
              <strong>{workspaceName}</strong>
            </span>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn sm ghost dash-help"
              onClick={() => open(stepForPath(pathname, script))}
            >
              <CircleHelp size={15} />
              {chrome.howItWorks}
            </button>
            {topRight}
          </div>
          <button
            type="button"
            className="dash-menu-close"
            aria-label={chrome.closeMenu}
            onClick={() => setNavOpen(false)}
          >
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
